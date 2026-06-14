import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    ssr: {
      external: ["openai", "pdfjs-dist"]
    }
  },
  nitro: {
    preset: "vercel",
  }
});
