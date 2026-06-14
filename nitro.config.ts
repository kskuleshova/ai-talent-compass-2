import { defineNitroConfig } from "nitropack";

export default defineNitroConfig({
  externals: {
    inline: [],
    external: ["openai", "pdfjs-dist"]
  }
});
