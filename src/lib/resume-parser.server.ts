import pdf from "pdf-parse";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ------------------------------
// MAIN FUNCTION
// ------------------------------
export async function extractResumeText(buffer: Buffer, ext: "pdf" | "docx"): Promise<string> {
  let text = "";

  // 1. Try normal PDF parsing
  if (ext === "pdf") {
    try {
      const parsed = await pdf(buffer);
      text = parsed.text.trim();

      if (text.length > 20) {
        console.log("[PDF PARSE] Success, length:", text.length);
        return text;
      }

      console.log("[PDF PARSE] Empty, switching to OCR...");
    } catch (e) {
      console.log("[PDF PARSE] Failed, switching to OCR...");
    }
  }

  // 2. DOCX parsing (simple)
  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value.trim();

      if (text.length > 20) {
        console.log("[DOCX PARSE] Success, length:", text.length);
        return text;
      }

      console.log("[DOCX PARSE] Empty, switching to OCR...");
    } catch (e) {
      console.log("[DOCX PARSE] Failed, switching to OCR...");
    }
  }

  // 3. OCR via OpenAI Vision
  console.log("[OCR] Starting OCR via OpenAI Vision...");

  const base64 = buffer.toString("base64");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Extract all readable text from this resume image/PDF page." },
          {
            type: "image_url",
            image_url: {
              url: `data:application/${ext};base64,${base64}`,
            },
          },
        ],
      },
    ],
  });

  const ocrText = response.choices[0].message.content?.trim() ?? "";

  console.log("[OCR] Extracted length:", ocrText.length);

  return ocrText;
}
