import { createStep } from "@mastra/core/workflows";
import { nanoid } from "nanoid";
import { saveResearchSession } from "@/lib/research-store";
import { ResearchInput, PlanStepOutput } from "../schemas";
import { llmPlan } from "../helpers";

export const planStep = createStep({
    id: "plan_queries",
    inputSchema: ResearchInput,
    outputSchema: PlanStepOutput,
    execute: async ({ inputData }) => {
        const { query, conversationId, userEmail, ragContext } = inputData;
        const sessionId = nanoid();
        const subQueries = await llmPlan(query);

        await saveResearchSession({
            id: sessionId,
            conversationId,
            userEmail,
            originalQuery: query,
            subQueries,
            status: "running",
        });

        return {
            sessionId,
            originalQuery: query,
            conversationId,
            userEmail,
            ragContext: ragContext ?? "",
            subQueries,
            progress: `📋 Planning research strategy for "${query.slice(0, 50)}${query.length > 50 ? "..." : ""}" — ${subQueries.length} angles identified`,
        };
    },
});
