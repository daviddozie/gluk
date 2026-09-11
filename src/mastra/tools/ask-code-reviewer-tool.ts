import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { codeReviewerAgent } from "../agents/code-reviewer-agent";

export const askCodeReviewerTool = createTool({
    id: "consult_code_reviewer",
    description:
        "Delegate code auditing, security review, and algorithmic optimization to the specialized Code Reviewer sub-agent. Use this whenever the user asks to review, audit, debug, optimize, or security-check a code snippet or architecture.",
    inputSchema: z.object({
        code: z.string().describe("The source code to be reviewed and audited"),
        language: z
            .string()
            .optional()
            .describe("The programming language (e.g. 'typescript', 'python', 'sql', 'rust')"),
        focusAreas: z
            .array(z.string())
            .optional()
            .describe("Specific areas to emphasize (e.g. ['security', 'performance', 'refactoring'])"),
    }),
    outputSchema: z.object({
        review: z.string(),
    }),
    execute: async ({ code, language, focusAreas }) => {
        const langHeader = language ? ` (${language})` : "";
        const focusHeader =
            focusAreas && focusAreas.length > 0
                ? `\nPlease focus particularly on: ${focusAreas.join(", ")}.`
                : "";

        const prompt = `Please audit and review the following code${langHeader}:${focusHeader}\n\n\`\`\`${language || ""}\n${code}\n\`\`\``;

        const result = await codeReviewerAgent.generate(prompt);

        return {
            review: result.text,
        };
    },
});
