import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import * as path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: { globPatterns: ["**/*.{js,css,html,ico,png,svg}"] },
    }),
  ],
  resolve: {
    alias: [
      {
        find: "@components",
        replacement: path.resolve(__dirname, "./src/components"),
      },
      { find: "@store", replacement: path.resolve(__dirname, "./src/store") },
      { find: "@models", replacement: path.resolve(__dirname, "./src/models") },
      { find: "@utils", replacement: path.resolve(__dirname, "./src/utils") },
      { find: "@assets", replacement: path.resolve(__dirname, "./src/assets") },
    ],
  },
});
