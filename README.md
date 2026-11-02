# 自考刷题 · Monorepo

一个仓库管理自考刷题相关的两套东西：

| 目录 | 是什么 | 技术栈 |
|---|---|---|
| [`apps/flashcard-app`](apps/flashcard-app/) | **闪卡刷题 App**：按 FSRS 记忆曲线安排复习的离线刷题应用，可打包成 Android APK | React 18 + TypeScript + Vite + Capacitor + Dexie + ts-fsrs |
| [`apps/review-notes`](apps/review-notes/) | **题库资料生成器**：把题库 JSON 转成「知识点归纳版 + 选择题速记版」TXT / DOCX | Python 3（docx 版需要 python-docx） |

两者配合使用：用生成器整理题库 → 导入闪卡 App 循环复习。

## 🚀 快速开始

### 闪卡刷题 App

```bash
cd apps/flashcard-app
npm install
npm run dev            # http://localhost:5173
```

Android 打包：

```bash
CAP_BUILD=1 npm run build    # Windows: $env:CAP_BUILD="1"
npx cap sync android
npx cap open android
```

### 题库资料生成器

```bash
cd apps/review-notes
pip install -r requirements.txt     # 只有 generate.py（DOCX）需要
python work/generate_txt.py --src ./data --out ./outputs
python work/generate.py     --src ./data --out ./outputs
```

题库 JSON 格式见 [`apps/review-notes/README.md`](apps/review-notes/README.md)，示例见 `apps/review-notes/examples/`。

## 📁 目录结构

```
apps/flashcard-app/     闪卡 App 源码（src/、public/、android/）
apps/review-notes/      资料生成器（work/、examples/）
```

## ℹ️ 关于内置题库

- **本仓库不含任何题库内容**（第三方真题有版权），App 的 `public/decks/index.json` 是空清单占位；
- 需要带题库的完整版见私有仓库 `shuati-shanka-private`（由本人保管，不公开）。

## ⚠️ 免责声明

题库内容版权归原权利人所有，本仓库不包含、不分发题库内容，仅提供代码。请使用自己合法拥有的学习资料，勿用于商业用途或二次分发。

## 🔗 历史仓库

- `zuopengliang47-spec/shuati-shanka`：资料生成器（本 monorepo 的 `apps/review-notes`）
- `zuopengliang47-spec/shuati-shanka-app`：闪卡 App（本 monorepo 的 `apps/flashcard-app`）
