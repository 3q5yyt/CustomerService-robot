import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4173",
      "/nimble-widget.js": "http://127.0.0.1:4173"
    }
  }
});
