# -*- coding: utf-8 -*-
"""考试复习资料刷题器 —— 题库 JSON -> 知识点归纳版 + 选择题速记版（DOCX），并打包 zip。

用法::

    pip install -r requirements.txt
    python work/generate.py --src ./data --out ./outputs
"""

import argparse
import zipfile
from collections import Counter
from pathlib import Path

import common

try:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor
except ImportError:  # 依赖缺失时给出友好提示
    Document = None


def _require_docx():
    if Document is None:
        raise SystemExit("缺少依赖 python-docx，请先运行：pip install -r requirements.txt")


def _set_font(run, cn="宋体", en="Times New Roman", size=10.5, bold=False, color=None):
    run.font.name = en
    run.font.size = Pt(size)
    run.font.bold = bold
    if color is not None:
        run.font.color.rgb = RGBColor(*color)
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.get_or_add_rFonts()
    rfonts.set(qn("w:eastAsia"), cn)


def add_para(doc, text="", cn="宋体", en="Times New Roman", size=10.5,
             bold=False, color=None, align=None, space_after=4, indent=None):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    if indent is not None:
        p.paragraph_format.left_indent = Pt(indent)
    if text:
        r = p.add_run(text)
        _set_font(r, cn=cn, en=en, size=size, bold=bold, color=color)
    return p


def add_kv(doc, label, text, indent=14, size=10.5):
    """加一行：加粗标签 + 普通正文。"""
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.left_indent = Pt(indent)
    r1 = p.add_run(label)
    _set_font(r1, cn="黑体", size=size, bold=True)
    r2 = p.add_run(text)
    _set_font(r2, cn="宋体", size=size, bold=False)
    return p


def _new_doc():
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(10.5)
    style.element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    return doc


def build_title(doc, title, subtitle_lines):
    add_para(doc, title, cn="黑体", en="Times New Roman", size=18,
             bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=8)
    for line in subtitle_lines:
        if not line:
            continue
        add_para(doc, line, cn="楷体", en="Times New Roman", size=10.5,
                 align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2, color=(0x60, 0x60, 0x60))
    add_para(doc, "", space_after=4)


def build_doc_A(subject):
    """知识点归纳版：全科一册，按题型分组，相同题干去重。"""
    _require_docx()
    code, name = subject["code"], subject["name"]
    questions = subject["questions"]
    groups = common.group_by_type(questions)
    distinct = sum(len(items) for items in groups.values())

    doc = _new_doc()
    build_title(doc, f"《{name}》知识点归纳", [
        f"课程代码：{code}" if code else "",
        f"题库总量：{len(questions)} 题　去重后知识点：{distinct} 条",
        "本册把全科题库作为一个整体进行归纳，按题型分组，相同题干已去重。",
        "答案来源为题库自带（部分为 AI 辅助核对，未经官方核定），仅供参考，请以官方教材为准。",
    ])

    sec = 0
    for q_type, type_name in common.TYPE_NAMES.items():
        items = groups.get(q_type, [])
        if not items:
            continue
        sec += 1
        add_para(doc, f"{common.CN_NUM[sec - 1]}、{type_name}知识点（{len(items)} 条）",
                 cn="黑体", size=14, bold=True, space_after=6)
        for i, q in enumerate(items, 1):
            stem = str(q.get("stem") or "").strip()
            letters, parts = common.render_answer(q)
            add_para(doc, f"{i}. {stem}", size=10.5, space_after=2)
            if q_type == "single":
                add_kv(doc, "答案：", f"{letters}．{'；'.join(parts)}")
            elif q_type == "multi":
                add_kv(doc, "答案：", letters)
                if parts:
                    add_para(doc, "；".join(parts), size=10.5, indent=14, space_after=4)
            elif q_type == "card":
                add_kv(doc, "参考答案：", "；".join(parts) or "（无答案）")
            else:
                add_kv(doc, "答案：", "；".join(parts) or "（无答案）")
    return doc, distinct


def build_doc_B(subject):
    """选择题速记版：仅单选+多选，去掉选项，直给答案（字母+正确选项原文）。"""
    _require_docx()
    code, name = subject["code"], subject["name"]
    questions = subject["questions"]
    singles = [q for q in questions if q.get("type") == "single"]
    multis = [q for q in questions if q.get("type") == "multi"]
    total_choice = len(singles) + len(multis)

    doc = _new_doc()
    build_title(doc, f"《{name}》选择题速记版", [
        f"课程代码：{code}" if code else "",
        f"单选题：{len(singles)} 题　多选题：{len(multis)} 题　合计：{total_choice} 题",
        "本册只收录选择题，去掉选项，题干后直接给出答案（字母＋正确选项原文），便于快速记忆。",
        "答案来源为题库自带（部分为 AI 辅助核对，未经官方核定），仅供参考，请以官方教材为准。",
    ])

    def write_group(title, items):
        add_para(doc, title, cn="黑体", size=14, bold=True, space_after=6)
        for i, q in enumerate(items, 1):
            stem = str(q.get("stem") or "").strip()
            letters, parts = common.render_answer(q)
            add_para(doc, f"{i}. {stem}", size=10.5, space_after=2)
            if q.get("type") == "multi":
                add_kv(doc, "答案：", letters)
                if parts:
                    add_para(doc, "；".join(parts), size=10.5, indent=14, space_after=4)
            else:
                add_kv(doc, "答案：", f"{letters}．{'；'.join(parts)}")

    write_group(f"一、单选题（{len(singles)} 题）", singles)
    if multis:
        write_group(f"二、多选题（{len(multis)} 题）", multis)
    return doc, total_choice


def main(argv=None):
    _require_docx()
    parser = argparse.ArgumentParser(description="题库 JSON -> 知识点归纳版 + 选择题速记版（DOCX）")
    parser.add_argument("--src", required=True, help="题库 JSON 所在目录（*.json）")
    parser.add_argument("--out", default="outputs", help="输出目录（默认 ./outputs）")
    parser.add_argument("--zip-name", default="考试复习资料（知识点归纳版+选择题速记版）.zip")
    parser.add_argument("--desktop", default=None, help="可选：额外把 zip 复制到这个目录")
    args = parser.parse_args(argv)

    subjects = common.load_subjects(args.src)
    out = Path(args.out)
    out_a = out / "知识点归纳版"
    out_b = out / "选择题速记版"
    out_a.mkdir(parents=True, exist_ok=True)
    out_b.mkdir(parents=True, exist_ok=True)

    files = []
    report = []
    for subject in subjects:
        code, name = subject["code"], subject["name"]
        cnt = Counter(q.get("type") for q in subject["questions"])

        doc_a, distinct = build_doc_A(subject)
        path_a = out_a / f"{common.output_stem(subject, '知识点归纳')}.docx"
        doc_a.save(path_a)
        files.append((path_a, f"知识点归纳版/{path_a.name}"))

        doc_b, choice = build_doc_B(subject)
        path_b = out_b / f"{common.output_stem(subject, '选择题速记')}.docx"
        doc_b.save(path_b)
        files.append((path_b, f"选择题速记版/{path_b.name}"))

        report.append((code, name, len(subject["questions"]), distinct, choice, dict(cnt)))
        label = f"{code}-{name}" if code else name
        print(f"[OK] {label}: 总题={len(subject['questions'])} 去重后={distinct} 选择题={choice} {dict(cnt)}")

    zip_path = out / args.zip_name
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for disk_path, arc_name in files:
            z.write(disk_path, arc_name)
    print(f"[ZIP] {zip_path}")

    if args.desktop:
        import shutil
        desktop_zip = Path(args.desktop) / args.zip_name
        shutil.copyfile(zip_path, desktop_zip)
        print(f"[DESKTOP] {desktop_zip}")

    print("\n==== 汇总 ====")
    for code, name, total, distinct, choice, cnt in report:
        label = f"{code}-{name}" if code else name
        print(f"{label}: 总题 {total}  去重后 {distinct}  选择题 {choice}  {cnt}")
    print(f"合计：{len(report)} 个科目，{sum(r[2] for r in report)} 题")


if __name__ == "__main__":
    main()
