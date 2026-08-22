import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/element-finder-dashboard.ts",
      formats: ["es"],
      fileName: "element-finder-dashboard.element",
    },
    outDir: "../wwwroot/App_Plugins/ElementFinder",
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
  publicDir: "public",
});
