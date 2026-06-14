import OpenAI from "openai";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

// Вказуємо шлях до воркера pdfjs (обовʼязково!)
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  "pdfjs-dist/legacy/build/pdf.worker.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Конвертація PDF-сторінки у PNG (чистий JS, без canvas)
async function renderPageToPng(page: any) {
  const viewport = page.getViewport({ scale: 2 });

  const canvasFactory = new pdfjsLib.NodeCanvasFactory();
  const canvasAndContext = canvasFactory.create(
    viewport.width,
    viewport.height
  );

  const renderContext = {
    canvasContext: canvasAndContext.context,
    viewport,
    canvasFactory,
  };

  await page.render(renderContext).promise;

  return canvasAndContext.canvas.toBuffer("image/png");
}

export async function extractResumeText(
  buf: Buffer,
  ext: "pdf" | "docx"
): Promise<string> {
  // DOCX
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return (value ?? "").trim();
  }

  // PDF → PNG → OCR
  if (ext === "pdf") {
    try {
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const pngBuffer = await renderPageToPng(page);
        const base64 = pngBuffer.toString("base64");

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all text from this resume page." },
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
      console.error("OpenAI OCR failed:", e);
      return "";
    }
  }

  return "";
}
