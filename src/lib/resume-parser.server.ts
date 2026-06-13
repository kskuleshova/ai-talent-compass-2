// Server-only resume text extractor. Imported from .functions.ts files via
// dynamic-safe top-level import (these libs are pure JS and Worker-compatible
// for our cases — pdf-parse + mammoth work in Node/Workers with buffers).
export async function extractResumeText(buf: Buffer, ext: "pdf" | "docx"): Promise<string> {
  if (ext === "pdf") {
    try {
      const str = buf.toString("latin1");
      const texts: string[] = [];
 
      const btEtRegex = /BT([\s\S]*?)ET/g;
      let match;
      while ((match = btEtRegex.exec(str)) !== null) {
        const block = match[1];
 
        const tRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
        const tjRegex = /\[((?:[^[\]]*|\[[^[\]]*\])*)\]\s*TJ/g;
 
        let m;
        while ((m = tRegex.exec(block)) !== null) {
          const t = m[1]
            .replace(/\\n/g, " ")
            .replace(/\\r/g, " ")
            .replace(/\\t/g, " ")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\");
          if (t.trim()) texts.push(t);
        }
        while ((m = tjRegex.exec(block)) !== null) {
          const parts = m[1].match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g) || [];
          for (const p of parts) {
            const t = p.slice(1, -1)
              .replace(/\\n/g, " ")
              .replace(/\\\(/g, "(")
              .replace(/\\\)/g, ")");
            if (t.trim()) texts.push(t);
          }
        }
      }
 
      // Filter to only printable ASCII + basic unicode, remove control chars
      const raw = texts.join(" ").replace(/\s+/g, " ").trim();
      const clean = raw.replace(/[^\x20-\x7E\u00A0-\u024F\u0400-\u04FF\s]/g, "").trim();
 
      console.log("PDF clean text length:", clean.length, "preview:", clean.slice(0, 100));
      return clean;
    } catch (e) {
      console.error("PDF parsing failed", e);
      return "";
    }
  }
  if (ext === "docx") {
    const mammoth: any = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return (value ?? "").trim();
  }
  return "";
}
