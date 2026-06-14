import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
  build: {
    rollupOptions: {
      external: ["openai", "pdfjs-dist"]
    }
  }
});
