import { createRequire } from "node:module";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);
// pdf-parse ships only CJS — use require() to avoid ESM "no default export" error
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

export async function parseResumeFromBase64(
  base64: string,
  ext: string
): Promise<string> {
  const buf = Buffer.from(base64, "base64");

  if (ext === "pdf") {
    try {
      const data = await pdfParse(buf);
      return data.text || "";
    } catch (e) {
      console.error("PDF parse error:", e);
      return "";
    }
  }

  if (ext === "docx") {
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value || "";
    } catch (e) {
      console.error("DOCX parse error:", e);
      return "";
    }
  }

  return "";
}
