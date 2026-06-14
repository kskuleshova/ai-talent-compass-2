import { PDFDocument } from "pdf-lib";
import { pdfToPng } from "@react-pdf/png";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ------------------------------
// OCR PARSER THAT WORKS ON VERCEL
// ------------------------------
export async function extractResumeText(buf: Buffer, ext: "pdf" | "docx"): Promise<string> {
  // DOCX — простий випадок
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return (value ?? "").trim();
  }

  // PDF — складний випадок
  if (ext === "pdf") {
    try {
      // 1. Завантажуємо PDF
      const pdfDoc = await PDFDocument.load(buf);
      const pageCount = pdfDoc.getPageCount();

      let fullText = "";

      // 2. Обробляємо кожну сторінку окремо
      for (let i = 0; i < pageCount; i++) {
        const png = await pdfToPng(buf, {
          page: i + 1,
          scale: 2, // якість
        });

        const base64 = png.content.toString("base64");

        // 3. OCR через OpenAI Vision
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all readable text from this resume page." },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${base64}`,
                  },
                },
              ],
            },
          ],
        });

        const pageText = response.choices[0].message.content ?? "";
        fullText += "\n" + pageText;
      }

      return fullText.trim();
    } catch (e) {
      console.error("OCR failed:", e);
      return "";
    }
  }

  return "";
}
