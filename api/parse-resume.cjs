import { extractTextFromPDF } from "../src/lib/pdf/extract-text.js"; // ← заміни шлях, якщо інший

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const buffers = [];

    for await (const chunk of req) {
      buffers.push(chunk);
    }

    const rawBody = Buffer.concat(buffers).toString("utf8");
    const { base64, ext } = JSON.parse(rawBody);

    const buffer = Buffer.from(base64, "base64");

    let text = "";

    if (ext === "pdf") {
      text = await extractTextFromPDF(buffer);
    } else {
      text = "DOCX parsing not implemented yet";
    }

    return res.status(200).json({ text });
  } catch (e) {
    console.error("parse-resume error:", e);
    return res.status(500).json({ error: e.message });
  }
}
