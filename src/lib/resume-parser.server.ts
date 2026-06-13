// Server-only resume text extractor. Imported from .functions.ts files via
// dynamic-safe top-level import (these libs are pure JS and Worker-compatible
// for our cases — pdf-parse + mammoth work in Node/Workers with buffers).
export async function extractResumeText(buf: Buffer, ext: "pdf" | "docx"): Promise<string> {
  if (ext === "pdf") {
    try {
      // Extract raw text from PDF by finding text streams
      const str = buf.toString("latin1");
      const texts: string[] = [];
      
      // Match BT...ET blocks (PDF text blocks)
      const btEtRegex = /BT([\s\S]*?)ET/g;
      let match;
      while ((match = btEtRegex.exec(str)) !== null) {
        const block = match[1];
        // Match strings in parentheses: (text)
        const strRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
        let strMatch;
        while ((strMatch = strRegex.exec(block)) !== null) {
          const text = strMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\");
          if (text.trim().length > 0) texts.push(text);
        }
      }
      
      return texts.join(" ").replace(/\s+/g, " ").trim();
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
}
