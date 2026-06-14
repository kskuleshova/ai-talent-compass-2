import mammoth from "mammoth";

export async function parseResumeFromBase64(
  base64: string,
  ext: string
): Promise<string> {
  const buf = Buffer.from(base64, "base64");

  if (ext === "pdf") {
    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

      // Disable worker entirely — required for Node.js / serverless environments
      pdfjsLib.GlobalWorkerOptions.workerSrc = false as any;

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buf),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        disableFontFace: true,
      });

      const pdf = await loadingTask.promise;
      const pages: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ");
        pages.push(text);
      }

      return pages.join("\n").trim();
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
