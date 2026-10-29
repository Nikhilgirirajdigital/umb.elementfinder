import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: __dirname,
  build: {
    lib: {
      entry: {
        "element-finder-dashboard.element": resolve(__dirname, "src/element-finder-dashboard.ts"),
        "content-cleaner-dashboard.element": resolve(__dirname, "src/content-cleaner-dashboard.ts"),
        "content-cleaner-usage-workspace.element": resolve(__dirname, "src/content-cleaner-usage-workspace.ts"),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    outDir: resolve(__dirname, "../wwwroot/App_Plugins/ElementFinder"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      external: [/^@umbraco/],
      output: {
        assetFileNames: "[name][extname]",
      },
    },
  },
  base: "/App_Plugins/ElementFinder/",
  publicDir: resolve(__dirname, "public"),
});
