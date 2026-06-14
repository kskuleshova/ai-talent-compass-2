import OpenAI from "openai";

export async function extractResumeText(buf: Buffer, ext: "pdf" | "docx"): Promise<string> {
  // DOCX — простий випадок
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return (value ?? "").trim();
  }

  // PDF — OCR через Google Vision
  if (ext === "pdf") {
    try {
      const apiKey = process.env.GOOGLE_VISION_API_KEY;
      if (!apiKey) throw new Error("Missing GOOGLE_VISION_API_KEY");

      const base64 = buf.toString("base64");

      const response = await fetch(
        `https://vision.googleapis.com/v1/files:annotate?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                inputConfig: {
                  mimeType: "application/pdf",
                  content: base64,
                },
                features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
              },
            ],
          }),
        }
      );

      const json = await response.json();

      const text =
        json?.responses?.[0]?.fullTextAnnotation?.text ??
        json?.responses?.[0]?.textAnnotations?.[0]?.description ??
        "";

      return text.trim();
    } catch (e) {
      console.error("Google Vision OCR failed:", e);
      return "";
    }
  }

  return "";
}
