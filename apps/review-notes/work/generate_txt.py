# -*- coding: utf-8 -*-
"""考试复习资料刷题器 —— 题库 JSON -> 知识点归纳版 + 选择题速记版（TXT），并打包 zip。

用法::

    python work/generate_txt.py --src ./data --out ./outputs
"""

import argparse
import zipfile
from collections import Counter
from pathlib import Path

import common


def build_doc_A_lines(subject):
    """知识点归纳版：全科一册，按题型分组，相同题干去重。"""
    code, name = subject["code"], subject["name"]
    questions = subject["questions"]
    groups = common.group_by_type(questions)
    distinct = sum(len(items) for items in groups.values())

    lines = [
        f"《{name}》知识点归纳",
        f"课程代码：{code}" if code else "",
        f"题库总量：{len(questions)} 题　　去重后知识点：{distinct} 条",
        "本册把全科题库作为一个整体进行归纳，按题型分组，相同题干已去重。",
        "答案来源为题库自带（部分为 AI 辅助核对，未经官方核定），仅供参考，请以官方教材为准。",
        "",
    ]

    sec = 0
    for q_type, type_name in common.TYPE_NAMES.items():
        items = groups.get(q_type, [])
        if not items:
            continue
        sec += 1
        lines.append(f"{common.CN_NUM[sec - 1]}、{type_name}知识点（{len(items)} 条）")
        lines.append("")
        for i, q in enumerate(items, 1):
            stem = str(q.get("stem") or "").strip()
            _, parts = common.render_answer(q)
            joined = "；".join(parts)
            lines.append(f"{i}. {stem}")
            if q_type in ("single", "multi"):
                lines.append(f"    {joined}")
            elif q_type == "card":
                lines.append(f"    参考答案：{joined or '（无答案）'}")
            else:
                lines.append(f"    答案：{joined or '（无答案）'}")
            lines.append("")
    return [ln for ln in lines if ln is not None], distinct


def build_doc_B_lines(subject):
    """选择题速记版：仅单选+多选，去掉选项，题干后直接给答案。"""
    code, name = subject["code"], subject["name"]
    questions = subject["questions"]
    singles = [q for q in questions if q.get("type") == "single"]
    multis = [q for q in questions if q.get("type") == "multi"]
    total_choice = len(singles) + len(multis)

    lines = [
        f"《{name}》选择题速记版（直给答案·无选项）",
        f"课程代码：{code}" if code else "",
        f"单选题：{len(singles)} 题　　多选题：{len(multis)} 题　　合计：{total_choice} 题",
        "本册只收录选择题，去掉选项，题干后直接给出正确选项原文，便于快速记忆。",
        "答案来源为题库自带（部分为 AI 辅助核对，未经官方核定），仅供参考，请以官方教材为准。",
        "",
    ]

    def write_group(title, items):
        lines.append(title)
        lines.append("")
        for i, q in enumerate(items, 1):
            stem = str(q.get("stem") or "").strip()
            _, parts = common.render_answer(q)
            lines.append(f"{i}. {stem}")
            lines.append(f"    {'；'.join(parts)}")
            lines.append("")

    write_group(f"一、单选题（{len(singles)} 题）", singles)
    if multis:
        write_group(f"二、多选题（{len(multis)} 题）", multis)
    return [ln for ln in lines if ln is not None], total_choice


def write_txt(path, lines):
    with open(path, "w", encoding="utf-8-sig", newline="\n") as f:
        f.write("\r\n".join(lines))
        f.write("\r\n")


def main(argv=None):
    parser = argparse.ArgumentParser(description="题库 JSON -> 知识点归纳版 + 选择题速记版（TXT）")
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

        lines_a, distinct = build_doc_A_lines(subject)
        path_a = out_a / f"{common.output_stem(subject, '知识点归纳')}.txt"
        write_txt(path_a, lines_a)
        files.append((path_a, f"知识点归纳版/{path_a.name}"))

        lines_b, choice = build_doc_B_lines(subject)
        path_b = out_b / f"{common.output_stem(subject, '选择题速记')}.txt"
        write_txt(path_b, lines_b)
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
