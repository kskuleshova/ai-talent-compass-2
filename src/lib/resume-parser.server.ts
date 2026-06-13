export async function extractResumeText(buf: Buffer, ext: "pdf" | "docx"): Promise<string> {
  if (ext === "pdf") {
    const mod: any = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = mod.default ?? mod;
    const result = await pdfParse(buf, { max: 0 });
    return (result.text ?? "").trim();
  }
  if (ext === "docx") {
    const mammoth: any = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return (value ?? "").trim();
  }
  return "";
}
