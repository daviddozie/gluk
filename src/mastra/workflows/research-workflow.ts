import { createWorkflow } from "@mastra/core/workflows";
import { ResearchInput, ResearchOutput } from "./research/schemas";
import {
    planStep,
    gatherStep,
    deepFetchStep,
    rerankStep,
    synthesiseStep,
} from "./research/steps";

// ─── Research Workflow Assembly ──────────────────────────────────────────────
// 5-step deep research pipeline:
// 1. Plan queries (LLM breakdown into 3-5 complementary search angles)
// 2. Gather sources (multi-query search via Tavily + initial deduplication)
// 3. Deep fetch (fetch and extract full text for top sources)
// 4. Rerank sources (credibility + relevance scoring, URL dedup, store in DB)
// 5. Synthesise (structure evidence, compute confidence, store findings & session)

export const researchWorkflow = createWorkflow({
    id: "research_workflow",
    inputSchema: ResearchInput,
    outputSchema: ResearchOutput,
})
    .then(planStep)
    .then(gatherStep)
    .then(deepFetchStep)
    .then(rerankStep)
    .then(synthesiseStep)
    .commit();

export { ResearchInput, ResearchOutput };
