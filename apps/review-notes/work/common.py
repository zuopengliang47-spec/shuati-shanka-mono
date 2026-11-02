# -*- coding: utf-8 -*-
"""共享逻辑：读取题库 JSON、去重、答案渲染、文件命名。

输入格式（每个 json 文件）::

    {
      "code": "00277",            # 可选，课程/科目代码
      "name": "行政管理学",        # 可选，科目名；缺省用文件名
      "questions": [
        {"type": "single", "stem": "题干", "options": ["A项", "B项"], "answer": ["A"]}
      ]
    }

type: single 单选 / multi 多选 / judge 判断 / blank 填空 / card 问答
answer: 选择题填选项字母（多选可多个），其余题型填文本。
"""

import json
import re
from collections import OrderedDict
from pathlib import Path

TYPE_NAMES = OrderedDict([
    ("single", "单选题"),
    ("multi", "多选题"),
    ("judge", "判断题"),
    ("blank", "填空题"),
    ("card", "问答题"),
])

CN_NUM = "一二三四五六七八九十"

_INVALID = re.compile(r'[\\/:*?"<>|\r\n]+')
_META_FILENAME = re.compile(r"^(\d{3,6})[-_ ]+(.+)$")


def norm(s):
    return re.sub(r"\s+", "", s or "").strip()


def safe_name(s):
    """转成可安全用于 Windows 文件名的字符串。"""
    cleaned = _INVALID.sub("-", str(s or "")).strip(" .-")
    return cleaned or "未命名"


def parse_meta(path, data):
    """从 JSON 的 code/name 字段或文件名解析出 (code, name)。"""
    code = str(data.get("code") or "").strip()
    name = str(data.get("name") or data.get("subject") or "").strip()
    if not code or not name:
        m = _META_FILENAME.match(Path(path).stem)
        if m:
            code = code or m.group(1).strip()
            name = name or m.group(2).strip()
    return code, name or Path(path).stem


def load_subjects(src):
    """读取目录下所有 *.json，返回科目列表。"""
    src = Path(src)
    if not src.is_dir():
        raise SystemExit(f"输入目录不存在：{src}")
    files = sorted(src.glob("*.json"))
    if not files:
        raise SystemExit(f"目录里没有 .json 题库文件：{src}")

    subjects = []
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8-sig"))
        except Exception as e:  # noqa: BLE001
            print(f"[SKIP] {f.name}: JSON 解析失败（{e}）")
            continue
        questions = data.get("questions") if isinstance(data, dict) else None
        if not isinstance(questions, list) or not questions:
            print(f"[SKIP] {f.name}: 缺少非空的 questions 数组")
            continue
        code, name = parse_meta(f, data)
        subjects.append({"file": f, "code": code, "name": name, "questions": questions})
    if not subjects:
        raise SystemExit("没有可用的题库，请检查输入格式")
    return subjects


def output_stem(subject, suffix):
    """输出文件名（不含扩展名），如 00277-行政管理学-知识点归纳。"""
    code = str(subject.get("code") or "").strip()
    name = safe_name(subject.get("name"))
    base = f"{code}-{name}" if code else name
    return f"{base}-{suffix}"


def letter_to_index(letter):
    if isinstance(letter, str) and len(letter) == 1 and letter.isalpha():
        return ord(letter.upper()) - ord("A")
    return None


def option_text(q, letter):
    idx = letter_to_index(letter)
    options = q.get("options") or []
    if idx is not None and 0 <= idx < len(options):
        return str(options[idx])
    return None


def render_answer(q):
    """返回 (letters, parts)。letters 为选择题答案字母串，parts 为展示用答案片段。"""
    q_type = q.get("type")
    ans = q.get("answer") or []
    parts = []
    for a in ans:
        if isinstance(a, str) and len(a) == 1 and a.isalpha():
            text = option_text(q, a)
            parts.append(text if text else a.upper())
        else:
            parts.append(str(a))
    letters = "".join(str(a).upper() for a in ans)
    return letters, parts


def dedup(questions):
    """按 (题型, 题干) 去重；问答题保留答案更长的一条。"""
    seen = {}
    order = []
    for q in questions:
        key = (q.get("type"), norm(q.get("stem")))
        if key not in seen:
            seen[key] = q
            order.append(key)
        elif q.get("type") == "card":
            cur = sum(len(str(a)) for a in (q.get("answer") or []))
            prev = sum(len(str(a)) for a in (seen[key].get("answer") or []))
            if cur > prev:
                seen[key] = q
    return [seen[k] for k in order]


def group_by_type(questions):
    """去重后按题型分组，返回 OrderedDict[type, list]。"""
    groups = OrderedDict((t, []) for t in TYPE_NAMES)
    for q in dedup(questions):
        groups.setdefault(q.get("type"), []).append(q)
    return groups
