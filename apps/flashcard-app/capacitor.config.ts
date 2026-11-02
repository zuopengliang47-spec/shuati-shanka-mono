import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android 壳配置。
 * - webDir 指向 `dist-native`（用 `CAP_BUILD=1` 构建、不含 Service Worker 的那份资源），
 *   题库 JSON、图标、字体全部在里面，随 APK 一起分发，装机即用、完全离线。
 * - androidScheme 用默认的 https，页面跑在 https://localhost 下，
 *   IndexedDB / localStorage 都能正常工作。
 */
const config: CapacitorConfig = {
  appId: "cn.xiaoheihe.flashcards",
  appName: "闪卡刷题",
  webDir: "dist-native",
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
