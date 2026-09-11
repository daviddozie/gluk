import { createTool } from "@mastra/core/tools";
import { z } from "zod";

function isPrivateOrLocalUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        const host = url.hostname.toLowerCase();

        // Check protocols
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return true;
        }

        // Localhost & loopback
        if (
            host === "localhost" ||
            host === "127.0.0.1" ||
            host === "0.0.0.0" ||
            host === "::1" ||
            host.endsWith(".local") ||
            host.endsWith(".internal")
        ) {
            return true;
        }

        // Cloud metadata endpoints (AWS, GCP, Azure)
        if (host === "169.254.169.254" || host === "metadata.google.internal") {
            return true;
        }

        // Private IPv4 ranges:
        // 10.0.0.0 – 10.255.255.255
        // 172.16.0.0 – 172.31.255.255
        // 192.168.0.0 – 192.168.255.255
        const ipv4Match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (ipv4Match) {
            const [, a, b] = ipv4Match.map(Number);
            if (a === 10) return true;
            if (a === 172 && b >= 16 && b <= 31) return true;
            if (a === 192 && b === 168) return true;
            if (a === 169 && b === 254) return true;
        }

        return false;
    } catch {
        return true;
    }
}

export const sendWebhookTool = createTool({
    id: "send_webhook",
    description:
        "Send an event, research alert, digest, or structured JSON payload to an external webhook URL (such as Slack, Discord, Zapier, Make, or custom API). Use this when the user instructs to notify a channel, send to an endpoint, or trigger a webhook.",
    inputSchema: z.object({
        webhookUrl: z.string().url().describe("The destination HTTP/HTTPS webhook URL"),
        title: z.string().describe("Subject or title of the notification"),
        message: z.string().describe("Main message content or markdown summary to dispatch"),
        data: z
            .record(z.string(), z.any())
            .optional()
            .describe("Optional structured JSON metadata or key-value payload to attach"),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        statusCode: z.number().optional(),
        destination: z.string(),
        deliveredAt: z.string(),
        summary: z.string(),
        error: z.string().optional(),
    }),
    execute: async ({ webhookUrl, title, message, data = {} }) => {
        const deliveredAt = new Date().toISOString();

        // SSRF protection
        if (isPrivateOrLocalUrl(webhookUrl)) {
            return {
                success: false,
                destination: webhookUrl,
                deliveredAt,
                summary: "Blocked dispatch: URL targets a private or internal network address (SSRF protection).",
                error: "Invalid target: private or loopback IP addresses are forbidden.",
            };
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const payload = {
                event: "gluk.research_digest",
                timestamp: deliveredAt,
                title,
                message,
                data,
            };

            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "GlukAgent/1.0 (+https://gluk.ai)",
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                return {
                    success: false,
                    statusCode: response.status,
                    destination: webhookUrl,
                    deliveredAt,
                    summary: `Webhook delivery failed with HTTP status ${response.status}: ${response.statusText}`,
                    error: response.statusText,
                };
            }

            return {
                success: true,
                statusCode: response.status,
                destination: webhookUrl,
                deliveredAt,
                summary: `📡 Webhook "${title}" delivered successfully to ${webhookUrl} (HTTP ${response.status}).`,
            };
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                destination: webhookUrl,
                deliveredAt,
                summary: `Webhook dispatch failed: ${errorMsg}`,
                error: errorMsg,
            };
        }
    },
});
