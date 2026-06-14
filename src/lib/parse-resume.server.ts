import mammoth from "mammoth";

export async function parseResumeFromBase64(
  base64: string,
  ext: string
): Promise<string> {
  const buf = Buffer.from(base64, "base64");

  if (ext === "pdf") {
    try {
      // Import both the lib and the worker — worker must be imported
      // so pdfjs can find it without a separate workerSrc URL
      const [pdfjsLib] = await Promise.all([
        import("pdfjs-dist/legacy/build/pdf.mjs"),
        import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
      ]);

      // After importing the worker module, pdfjs registers it internally
      // Set workerSrc to empty string to use the already-loaded worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buf),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        disableFontFace: true,
      });

      const pdf = await loadingTask.promise;
      console.log("[parse-resume] PDF loaded, pages:", pdf.numPages);

      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ");
        pages.push(text);
      }

      const result = pages.join("\n").trim();
      console.log("[parse-resume] Total text length:", result.length);
      return result;
    } catch (e) {
      console.error("PDF parse error:", e);
      return "";
    }
  }

  if (ext === "docx") {
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      console.log("[parse-resume] DOCX text length:", result.value.length);
      return result.value || "";
    } catch (e) {
      console.error("DOCX parse error:", e);
      return "";
    }
  }

  return "";
}
