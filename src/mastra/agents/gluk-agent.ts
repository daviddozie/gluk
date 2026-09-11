import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { webSearchTool } from "../tools/web-search-tool";
import { webFetchTool } from "../tools/web-fetch-tool";
import { sourceRerankTool } from "../tools/source-rerank-tool";
import { exportReportTool } from "../tools/export-report-tool";
import { saveDigestTool } from "../tools/save-digest-tool";
import { sendWebhookTool } from "../tools/send-webhook-tool";
import { askFactCheckerTool } from "../tools/ask-fact-checker-tool";
import { askCodeReviewerTool } from "../tools/ask-code-reviewer-tool";
import { factCheckerAgent } from "./fact-checker-agent";
import { codeReviewerAgent } from "./code-reviewer-agent";
import { GLUK_INSTRUCTIONS } from "./gluk-instructions";

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY!,
});

const memory = new Memory({
    storage: new LibSQLStore({
        id: "gluk-memory",
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
    }),
    options: {
        lastMessages: 40,
    },
});

export const glukAgent = new Agent({
    id: "gluk_agent",
    name: "Gluk",
    instructions: GLUK_INSTRUCTIONS,
    model: openrouter(process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat"),
    tools: {
        webSearchTool,
        webFetchTool,
        sourceRerankTool,
        exportReportTool,
        saveDigestTool,
        sendWebhookTool,
        askFactCheckerTool,
        askCodeReviewerTool,
    },
    agents: {
        factCheckerAgent,
        codeReviewerAgent,
    },
    memory,
});