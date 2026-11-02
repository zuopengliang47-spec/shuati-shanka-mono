import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/** 版本号只写一处：package.json 的 version，界面和安装包都用它。 */
const appVersion = (
  JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }
).version;

/**
 * CAP_BUILD=1 时产出的是要打进 Android APK 的资源：
 * 这些资源本来就随安装包发布、永远是本机最新的一份，Service Worker 只会帮倒忙
 * （WebView 里缓存策略更容易出「改了代码但界面没变」的怪事），所以此时不注册 SW。
 */
const isNativeBundle = process.env.CAP_BUILD === "1";

const pwa = VitePWA({
  registerType: "autoUpdate",
  injectRegister: "auto",
  includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
  manifest: {
    name: "闪卡刷题 · 记忆曲线",
    short_name: "闪卡刷题",
    description: "按 FSRS 记忆曲线安排复习的离线刷题工具，数据只存本机。",
    lang: "zh-CN",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1020",
    theme_color: "#111827",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
    navigateFallback: "/index.html",
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        // 内置题库：联网时优先拿最新的（题库会更新），断网时回退到缓存，所以离线也能重新导入。
        // 不能用 CacheFirst，否则浏览器里会一直用旧的题库副本。
        urlPattern: /\/decks\/.*\.json$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "builtin-decks-v2",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
    ],
  },
  devOptions: { enabled: false },
});

export default defineConfig({
  plugins: [react(), ...(isNativeBundle ? [] : [pwa])],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  server: { port: 5173, strictPort: false },
});
