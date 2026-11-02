# 刷题闪卡 · 考试复习资料刷题器

把**任意科目**的题库 JSON 导入，自动生成两类考前刷题资料：

- **知识点归纳版**：按题型分组、相同题干去重，适合系统过一遍；
- **选择题速记版**：去掉选项，题干后直接给正确选项原文，适合快速刷选择。

不限定科目、不限定数量——按输入格式放进 `data/`，跑一条命令就行。

> ⚠️ 本仓库**只包含转换程序，不包含任何题库内容**（第三方题库有版权，不上传）。

## ✨ 特性

- 支持任意科目/任意数量的题库，一个 JSON 一个科目；
- 内置 5 种题型：单选、多选、判断、填空、问答；
- 按「题型 + 题干」自动去重，问答题保留答案更完整的版本；
- 同时输出 **TXT**（轻量、可搜索）和 **DOCX**（可打印排版）；
- 自动打包 zip，可选复制到桌面。

## 📥 输入格式

每个科目一个 JSON 文件，放在 `data/` 目录下：

```json
{
  "code": "00277",
  "name": "行政管理学",
  "questions": [
    {
      "type": "single",
      "stem": "题干",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": ["A"]
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `questions` | ✅ | 题目数组，为空会被跳过 |
| `code` | 可选 | 科目/课程代码，会出现在文件名和标题里 |
| `name` | 可选 | 科目名；缺省时用文件名（如 `00277-行政管理学.json` 也能识别） |
| `type` | ✅ 每题 | `single` 单选 / `multi` 多选 / `judge` 判断 / `blank` 填空 / `card` 问答 |
| `stem` | ✅ 每题 | 题干 |
| `options` | 选择题 | 选项文本数组 |
| `answer` | ✅ 每题 | 选择题填选项字母（多选可多个），其余题型填文本 |

完整示例见 [`examples/sample-001-示例科目.json`](examples/sample-001-示例科目.json)。

文件名建议用 `代码-科目名.json`；不符合也没关系，程序会从 `code`/`name` 字段或文件名兜底。

## 🚀 快速开始

```bash
git clone https://github.com/zuopengliang47-spec/shuati-shanka.git
cd shuati-shanka

# 1) 把你的题库 JSON 放进 data/
mkdir data
cp /path/to/你的题库.json data/

# 2) 生成 TXT（无第三方依赖）
python work/generate_txt.py --src ./data --out ./outputs

# 3) 生成 DOCX（需要 python-docx）
pip install -r requirements.txt
python work/generate.py --src ./data --out ./outputs
```

先拿示例试跑：

```bash
python work/generate_txt.py --src ./examples --out ./outputs
```

## ⚙️ 参数

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--src` | 必填 | 题库 JSON 所在目录（只读该目录下 `*.json`） |
| `--out` | `outputs` | 输出目录 |
| `--zip-name` | `考试复习资料（知识点归纳版+选择题速记版）.zip` | 打包文件名 |
| `--desktop` | 不复制 | 可选：额外把 zip 复制到指定目录（如桌面） |

## 📁 输出结构

```
outputs/
  知识点归纳版/00277-行政管理学-知识点归纳.txt
  选择题速记版/00277-行政管理学-选择题速记.txt
  考试复习资料（知识点归纳版+选择题速记版）.zip
```

DOCX 版输出目录相同，扩展名为 `.docx`。

## 🗂 目录结构

```
work/
  common.py         读取题库、去重、答案解析、文件命名
  generate_txt.py   生成 TXT + zip
  generate.py       生成 DOCX + zip
examples/
  sample-001-示例科目.json   输入格式示例
requirements.txt    python-docx（仅 DOCX 版需要）
```

## ❓ 常见问题

- **答案准确吗？** 答案来自你导入的题库，本工具只做格式转换和去重，不校验对错；请以官方教材为准。
- **能加别的题型吗？** 可以，在 `work/common.py` 的 `TYPE_NAMES` 里加一项，并在两个生成脚本里补对应的输出分支。
- **题库会上传吗？** 不会。`data/`、`outputs/`、`*.json` 已在 `.gitignore` 里，只有 `examples/` 的示例会被跟踪。

## ⚠️ 免责声明

题库内容版权归原权利人所有，本仓库不包含、不分发题库内容，仅提供转换逻辑。请勿将生成的资料用于商业用途。
