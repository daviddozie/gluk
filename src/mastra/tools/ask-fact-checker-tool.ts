import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { factCheckerAgent } from "../agents/fact-checker-agent";

export const askFactCheckerTool = createTool({
    id: "consult_fact_checker",
    description:
        "Delegate claim verification to the specialized Fact-Checker sub-agent. Use this when a user's prompt or research involves controversial claims, statistical assertions, historical facts, rumors, or unverified statements that require forensic cross-examination against live web evidence.",
    inputSchema: z.object({
        claim: z.string().describe("The specific factual claim or assertion to investigate"),
        context: z
            .string()
            .optional()
            .describe("Optional background context, surrounding paragraph, or source attributing the claim"),
    }),
    outputSchema: z.object({
        claim: z.string(),
        report: z.string(),
    }),
    execute: async ({ claim, context }) => {
        const prompt = context
            ? `Investigate and fact-check this claim:\n"${claim}"\n\nBackground Context:\n${context}`
            : `Investigate and fact-check this claim:\n"${claim}"`;

        const result = await factCheckerAgent.generate(prompt, {
            maxSteps: 5,
        });

        return {
            claim,
            report: result.text,
        };
    },
});
