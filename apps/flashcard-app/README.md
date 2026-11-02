# 刷题闪卡 App · FSRS 记忆曲线

纯前端的离线刷题 / 闪卡应用：把题库变成按记忆曲线追着你复习的卡片。React 18 + TypeScript + Vite，Android 端用 Capacitor 打包成 APK；所有数据只存在本机 IndexedDB，不上传服务器。

> 这是**源码仓库**，不含内置题库。原项目打包过的 15 套、7492 道题来自第三方，涉及版权，已剔除；仓库里只留一个空题库清单占位，导入自己的题库即可使用。

## ✨ 功能

- **今日**：到期卡片数、未学新题数、连续打卡天数，一键开始。
- **复习**：两种模式
  - 闪卡模式：先自己想 → 显示答案 → 按「忘记 / 模糊 / 记住 / 太简单」四档自评；
  - 刷题模式：选完自动判分并映射到 FSRS 评分；
  - 每张卡的评分按钮上直接显示「选了之后下次什么时候再见」，支持键盘 `1 2 3 4` 和滑动评分。
- **题库**：导入 JSON / CSV / 粘贴文本，按题干自动去重；同 id 内容变化会覆盖旧版本；支持搜索、删除、导出备份、清空。
- **答案溯源**：每道题可标注答案出处（源站参考答案 / AI 补充 / 低置信），哪些题需要查教材一目了然。
- **统计**：题库总量、记住率、平均每题耗时、未来 7 天到期分布、卡片所处阶段（未学 / 学习中 / 复习中 / 重学中）。
- **设置**：每日新题配额、单次复习上限、默认模式、复习范围（全部科目 / 单科）。
- **可安装 / 可离线**：PWA 架构，浏览器「添加到主屏幕」后是一个独立 App；首次打开后断网也能复习。

## 🧱 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18、TypeScript、Vite 5 |
| 记忆算法 | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)（FSRS v5） |
| 本地存储 | Dexie 4（IndexedDB） |
| 公式渲染 | KaTeX |
| PWA | vite-plugin-pwa / Workbox |
| Android | Capacitor 7（appId `cn.xiaoheihe.flashcards`，versionName 1.3.1 / versionCode 5） |

## 📁 目录结构

```
src/                  应用代码
  pages/              Today / Review / Deck / Stats / Settings
  db.ts               Dexie 数据库与设置
  scheduler.ts        FSRS 调度与评分映射
  importer.ts         JSON / CSV 导入解析
  decks.ts            内置题库清单加载
  MathText.tsx        KaTeX 渲染
public/               图标 + decks/index.json（空清单占位）
android/              Capacitor Android 工程（签名文件未入库）
```

## 🚀 开发

```bash
npm install
npm run dev                 # http://localhost:5173
npm run build               # PWA 构建 → dist/
CAP_BUILD=1 npm run build   # Android 用资源（不注册 Service Worker）→ dist-native/
npx cap sync android
npx cap open android        # 用 Android Studio 打开
```

Windows PowerShell 里设置环境变量用 `$env:CAP_BUILD="1"`。

## 📱 Android 打包

- `appId`: `cn.xiaoheihe.flashcards`，`versionName` 在 `android/app/build.gradle`；
- **仓库不含签名文件**：`android/keystore.properties` 不存在时，`build.gradle` 会自动回退 debug 签名，本地能直接出包；正式发布请自建 keystore 并本地配置（`android/keystore/`、`keystore.properties` 已在 `.gitignore` 中）。

## 📥 题库格式

导入 JSON 时，顶层可以是数组，或 `{ "questions": [...] }`：

```json
[
  {
    "id": "可选，默认按题干 hash",
    "type": "single",
    "stem": "题干",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "answer": ["A"],
    "explanation": "解析（可选）",
    "tags": ["00277"],
    "source": "来源（可选）",
    "answerSource": "答案出处（可选）"
  }
]
```

- `type`：`single` 单选 / `multi` 多选 / `judge` 判断 / `blank` 填空 / `card` 问答；
- `answer`：数组或字符串；选择题填选项字母，其余填文本；
- CSV：支持「正面,背面,标签」两列/三列格式，或「题干,选项A,选项B,选项C,选项D,答案,解析,标签」。

## ℹ️ 关于内置题库

原项目（2026-10 版）曾内置 15 套题库（自考 13 科 6175 题 + 全国计算机等级 2 套 1317 题），题面与答案来自公开网络资料。因版权原因，这些题库**没有放进本仓库**；`public/decks/index.json` 是一个空清单，App 启动不会报错，进入「题库」导入自己的数据即可。

## ⚠️ 免责声明

题库内容版权归原权利人所有；本仓库仅包含应用代码，不包含、不分发题库内容。请使用你自己合法拥有的学习资料，勿将导入的题库用于商业用途或二次分发。
