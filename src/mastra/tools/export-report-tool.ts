import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { v2 as cloudinary } from "cloudinary";
import Papa from "papaparse";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const exportReportTool = createTool({
    id: "export_report",
    description:
        "Generate and export downloadable reports, datasets, or summaries as CSV, Markdown, HTML, or JSON files. Uploads the file to persistent cloud storage and returns a secure, clickable download URL. Use this whenever the user requests a downloadable spreadsheet, table export, CSV data, or formal report.",
    inputSchema: z.object({
        title: z.string().describe("Descriptive title of the file or report (e.g. 'AI Models Comparison 2026')"),
        format: z
            .enum(["csv", "markdown", "html", "json"])
            .describe("The output file format"),
        content: z
            .string()
            .optional()
            .describe("Text content for Markdown, HTML, or raw CSV/JSON formats"),
        csvRows: z
            .array(z.record(z.string(), z.any()))
            .optional()
            .describe("Array of structured data objects to be formatted into CSV (e.g. [{ model: 'GPT-4', score: 95 }])"),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        filename: z.string(),
        format: z.string(),
        downloadUrl: z.string(),
        markdownLink: z.string(),
        summary: z.string(),
    }),
    execute: async ({ title, format, content, csvRows }) => {
        let fileContent = content || "";

        // If CSV format and structured rows provided, unparse to CSV
        if (format === "csv") {
            if (csvRows && csvRows.length > 0) {
                fileContent = Papa.unparse(csvRows);
            } else if (!fileContent) {
                fileContent = "Title\n" + title;
            }
        } else if (format === "json" && !fileContent && csvRows) {
            fileContent = JSON.stringify(csvRows, null, 2);
        }

        const ext = format === "markdown" ? "md" : format;
        const cleanTitle = title
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_")
            .slice(0, 40);
        const filename = `${cleanTitle}_${Date.now()}.${ext}`;

        const mimeTypes: Record<string, string> = {
            csv: "text/csv",
            markdown: "text/markdown",
            html: "text/html",
            json: "application/json",
        };
        const mimeType = mimeTypes[format] || "text/plain";
        const base64Data = Buffer.from(fileContent, "utf8").toString("base64");
        const dataUri = `data:${mimeType};base64,${base64Data}`;

        let downloadUrl = dataUri;

        // Upload to Cloudinary for permanent hosting
        try {
            if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
                const uploadResult = await cloudinary.uploader.upload(dataUri, {
                    folder: "gluk/exports",
                    resource_type: "raw",
                    public_id: filename,
                });
                if (uploadResult.secure_url) {
                    downloadUrl = uploadResult.secure_url;
                }
            }
        } catch (uploadErr) {
            console.warn("Cloudinary export upload fallback to data URI:", uploadErr);
        }

        const markdownLink = `[📥 Download ${title} (${ext.toUpperCase()})](${downloadUrl})`;
        const summary = `Exported ${title} as a ${ext.toUpperCase()} file (${(fileContent.length / 1024).toFixed(1)} KB). Download link is available.`;

        return {
            success: true,
            filename,
            format,
            downloadUrl,
            markdownLink,
            summary,
        };
    },
});
