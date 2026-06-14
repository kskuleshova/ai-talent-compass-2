import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
    bundledDependencies: ["pdf-parse", "mammoth"],
  },
  ssr: {
    noExternal: ["openai", "pdfjs-dist", "pdf-parse", "mammoth"]
  }
});
