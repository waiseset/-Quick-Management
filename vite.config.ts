import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 开发时前端跑在 1420 端口，strictPort 保证端口被占用时直接报错而不是静默换端口
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // src-tauri 由 cargo 自己监听，避免 vite 重复触发
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome110",
    sourcemap: false,
  },
});
