import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
// import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: path.join(__dirname, "public"),
  plugins: [
    react(),
    tsconfigPaths(),
    // VitePWA({
    //   srcDir: "src",
    //   filename: "service-worker.ts",
    //   strategies: "injectManifest",
    // }),
  ],
  esbuild: {
    legalComments: "none",
  },
  define: {
    // https://vitest.dev/guide/in-source.html#production-build
    "import.meta.vitest": "undefined",
  },
  test: {
    // https://vitest.dev/config/
    environment: "jsdom",
    setupFiles: ["./test-setup.ts", "node_modules/fake-indexeddb/auto"],
    globals: true,
  },
});
