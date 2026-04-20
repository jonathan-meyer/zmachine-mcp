import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
  },
  server: {
    hmr: {
      path: "/__vite_hmr",
    },
  },
});
