// Server-only resume text extractor. Imported from .functions.ts files via
// dynamic-safe top-level import (these libs are pure JS and Worker-compatible
// for our cases — pdf-parse + mammoth work in Node/Workers with buffers).
export async function extractResumeText(buf: Buffer, ext: "pdf" | "docx"): Promise<string> {
  if (ext === "pdf") {
    // Use pdfjs-dist directly with Node.js compatible settings
    const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
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
  }
  if (ext === "docx") {
    const mammoth: any = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return (value ?? "").trim();
  }
  return "";
}
