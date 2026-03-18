export interface ProcessedDocument {
    text: string;
    name: string;
    type: string;
    chunks: string[];
}

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];

    let i = 0;
    while (i < words.length) {
        const chunk = words.slice(i, i + chunkSize).join(" ");
        if (chunk.trim()) chunks.push(chunk.trim());
        i += chunkSize - overlap;
    }

    return chunks;
}

export async function processDocument(
    buffer: Buffer,
    fileName: string,
    mimeType: string
): Promise<ProcessedDocument> {
    let text = "";

    if (mimeType === "application/pdf") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfParse = require("pdf-parse");
        const parsed = await pdfParse(buffer);
        text = parsed.text;

    } else if (mimeType === "text/csv" || fileName.endsWith(".csv")) {
        const Papa = (await import("papaparse")).default;
        const csv = buffer.toString("utf-8");
        const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
        text = result.data
            .map((row: unknown) => {
                const r = row as Record<string, unknown>;
                return Object.entries(r)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ");
            })
            .join("\n");

    } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".docx")
    ) {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;

    } else if (mimeType === "text/plain" || fileName.endsWith(".txt") || fileName.endsWith(".md")) {
        text = buffer.toString("utf-8");

    } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
    }

    text = text.replace(/\s+/g, " ").trim();

    return {
        text,
        name: fileName,
        type: mimeType,
        chunks: chunkText(text),
    };
}
