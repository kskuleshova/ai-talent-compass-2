const OpenAI = require("openai");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// Вказуємо шлях до воркера pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "pdfjs-dist/legacy/build/pdf.worker.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractPdfText(buffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });

    const canvasFactory = new pdfjsLib.NodeCanvasFactory();
    const { canvas, context } = canvasFactory.create(
      viewport.width,
      viewport.height
    );

    await page.render({
      canvasContext: context,
      viewport,
      canvasFactory,
    }).promise;

    const png = canvas.toBuffer("image/png");
    const base64 = png.toString("base64");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract text from this resume page." },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${base64}` },
            },
          ],
        },
      ],
    });

    fullText += response.choices[0].message.content + "\n";
  }

  return fullText.trim();
}

async function extractDocxText() {
  throw new Error("DOCX parsing not implemented yet");
}

async function extractResumeText(buffer, ext) {
  if (ext === "pdf") return extractPdfText(buffer);
  if (ext === "docx") return extractDocxText(buffer);
  throw new Error("Unsupported file type");
}

module.exports = { extractResumeText };
