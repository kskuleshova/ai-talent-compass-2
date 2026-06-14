import mammoth from "mammoth";

export async function parseResumeFromBase64(
  base64: string,
  ext: string
): Promise<string> {
  const buf = Buffer.from(base64, "base64");

  if (ext === "pdf") {
    try {
      const PDFParser = (await import("pdf2json")).default;

      const text = await new Promise<string>((resolve, reject) => {
        const parser = new PDFParser(null, true);

        parser.on("pdfParser_dataReady", (data: any) => {
          try {
            const pages = data?.Pages ?? [];
            const result = pages
              .map((page: any) =>
                (page.Texts ?? [])
                  .map((t: any) =>
                    (t.R ?? [])
                      .map((r: any) => decodeURIComponent(r.T ?? ""))
                      .join("")
                  )
                  .join(" ")
              )
              .join("\n");
            resolve(result.trim());
          } catch (e) {
            reject(e);
          }
        });

        parser.on("pdfParser_dataError", (err: any) => {
          reject(new Error(err?.parserError ?? "PDF parse error"));
        });

        parser.parseBuffer(buf);
      });

      return text;
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
