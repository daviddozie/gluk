/**
 * Automated test suite for Gluk's Temporal Grounding and Freshness Mechanism.
 *
 * Covers:
 * 1. Runtime System Clock & Timezone-Aware Context
 * 2. Relative Temporal Expressions Resolution
 * 3. Freshness Policy & Intent Classification
 * 4. Publication Date Scoring & Recency Reranking
 * 5. Dynamic Agent Instructions & System Clock Anchoring
 * 6. Agent Response Verification:
 *    - "What's today's date?"
 *    - "What day is it?"
 *    - "What happened today?"
 *    - "What happened this week?"
 *    - "What is the latest information about X?"
 *    - Verification that agent does NOT use stale LLM knowledge (e.g. 2024)
 */

import {
    getSystemTemporalContext,
    resolveQueryTemporalExpressions,
    evaluateFreshness,
    isPureDateQuery,
    buildTemporalGroundingInstructions,
    DEFAULT_TIMEZONE,
} from "../src/lib/temporal";
import { computeFreshnessScore, sourceRerankTool } from "../src/mastra/tools/source-rerank-tool";
import { glukAgent } from "../src/mastra/agents/gluk-agent";
import { RequestContext } from "@mastra/core/request-context";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

async function runTests() {
    console.log("\n========================================================");
    console.log("  GLUK TEMPORAL GROUNDING & FRESHNESS TEST SUITE");
    console.log("========================================================\n");

    const systemNow = new Date();
    const ctx = getSystemTemporalContext("Africa/Lagos", systemNow);

    console.log("System Clock Source of Truth:");
    console.log(`  ISO:       ${ctx.iso}`);
    console.log(`  Date:      ${ctx.formattedDate}`);
    console.log(`  Day:       ${ctx.dayOfWeek}`);
    console.log(`  Year:      ${ctx.year}`);
    console.log(`  Timezone:  ${ctx.timezone} (${ctx.utcOffset})\n`);

    // ─── Test 1: Runtime System Clock Source of Truth ─────────────────────────
    console.log("--- Test 1: Runtime System Clock Source of Truth ---");
    assert(ctx.year >= 2026, `Current year is >= 2026 (actual: ${ctx.year})`);
    assert(ctx.timezone === "Africa/Lagos", `Default timezone is Africa/Lagos (actual: ${ctx.timezone})`);
    assert(ctx.utcOffset === "+01:00", `WAT offset is +01:00 (actual: ${ctx.utcOffset})`);
    assert(typeof ctx.formattedDate === "string" && ctx.formattedDate.includes(String(ctx.year)), `Formatted date includes current year: "${ctx.formattedDate}"`);
    assert(typeof ctx.dayOfWeek === "string" && ctx.dayOfWeek.length > 0, `Day of week is resolved: "${ctx.dayOfWeek}"`);

    // Verify future year works dynamically without hardcoding
    const futureDate = new Date("2028-04-15T14:30:00Z");
    const futureCtx = getSystemTemporalContext("Africa/Lagos", futureDate);
    assert(futureCtx.year === 2028, `Future year 2028 dynamically handled (actual: ${futureCtx.year})`);
    assert(futureCtx.monthName === "April", `Future month April dynamically handled (actual: ${futureCtx.monthName})`);

    // ─── Test 2: Relative Temporal Expressions Resolution ────────────────────
    console.log("\n--- Test 2: Relative Temporal Expressions Resolution ---");

    const resToday = resolveQueryTemporalExpressions("What happened today in the news?", ctx);
    assert(resToday.hasTemporalExpression === true, "Recognizes 'today'");
    assert(resToday.expressionType === "today", "Type is 'today'");
    assert(resToday.tavilyTimeRange === "day", "Maps 'today' to Tavily time_range 'day'");
    assert(resToday.startDate === ctx.calendarDate, `Today's start date matches calendarDate (${ctx.calendarDate})`);

    const resYesterday = resolveQueryTemporalExpressions("Show me what happened yesterday", ctx);
    assert(resYesterday.hasTemporalExpression === true, "Recognizes 'yesterday'");
    assert(resYesterday.expressionType === "yesterday", "Type is 'yesterday'");
    assert(resYesterday.tavilyTimeRange === "day", "Maps 'yesterday' to Tavily time_range 'day'");

    const resThisWeek = resolveQueryTemporalExpressions("What happened this week?", ctx);
    assert(resThisWeek.hasTemporalExpression === true, "Recognizes 'this week'");
    assert(resThisWeek.expressionType === "this_week", "Type is 'this_week'");
    assert(resThisWeek.tavilyTimeRange === "week", "Maps 'this week' to Tavily time_range 'week'");
    assert(resThisWeek.startDate !== undefined && resThisWeek.endDate !== undefined, `This week has window: ${resThisWeek.startDate} to ${resThisWeek.endDate}`);

    const resLastWeek = resolveQueryTemporalExpressions("Summarize top stories from last week", ctx);
    assert(resLastWeek.hasTemporalExpression === true, "Recognizes 'last week'");
    assert(resLastWeek.expressionType === "last_week", "Type is 'last_week'");
    assert(resLastWeek.tavilyTimeRange === "week", "Maps 'last week' to Tavily time_range 'week'");

    const resThisMonth = resolveQueryTemporalExpressions("Break down events from this month", ctx);
    assert(resThisMonth.hasTemporalExpression === true, "Recognizes 'this month'");
    assert(resThisMonth.expressionType === "this_month", "Type is 'this_month'");
    assert(resThisMonth.tavilyTimeRange === "month", "Maps 'this month' to Tavily time_range 'month'");

    const resRecent = resolveQueryTemporalExpressions("give me a break down of what happen to bamboo recently", ctx);
    assert(resRecent.hasTemporalExpression === true, "Recognizes 'recently'");
    assert(resRecent.expressionType === "recent", "Type is 'recent'");
    assert(resRecent.targetYear === ctx.year, `Target year is current year (${ctx.year})`);

    const resLatest = resolveQueryTemporalExpressions("What is the latest information about OpenAI?", ctx);
    assert(resLatest.hasTemporalExpression === true, "Recognizes 'latest'");
    assert(resLatest.targetYear === ctx.year, `Latest targets current year ${ctx.year}`);

    // ─── Test 3: Freshness Policy & Intent Classification ─────────────────────
    console.log("\n--- Test 3: Freshness Policy & Intent Classification ---");

    // Pure date queries
    assert(isPureDateQuery("What's today's date?") === true, "Identifies 'What's today's date?' as pure date query");
    assert(isPureDateQuery("What is today's date") === true, "Identifies 'What is today's date' as pure date query");
    assert(isPureDateQuery("What day is it?") === true, "Identifies 'What day is it?' as pure date query");
    assert(isPureDateQuery("what day of the week is it") === true, "Identifies 'what day of the week is it' as pure date query");
    assert(isPureDateQuery("what year is this?") === true, "Identifies 'what year is this?' as pure date query");

    const evalDate = evaluateFreshness("What's today's date?", ctx);
    assert(evalDate.isPureDateQuery === true, "Freshness evaluation confirms isPureDateQuery");
    assert(evalDate.shouldUseWebSearch === false, "Pure date query does not require web search (answered from clock)");

    // Time-sensitive queries
    const evalToday = evaluateFreshness("What happened today?", ctx);
    assert(evalToday.isPureDateQuery === false, "'What happened today?' is not a pure date query");
    assert(evalToday.isTimeSensitive === true, "'What happened today?' is time-sensitive");
    assert(evalToday.shouldUseWebSearch === true, "'What happened today?' triggers web search");
    assert(evalToday.suggestedTimeRange === "day", "'What happened today?' suggests time_range 'day'");

    const evalThisWeek = evaluateFreshness("What happened this week?", ctx);
    assert(evalThisWeek.isTimeSensitive === true, "'What happened this week?' is time-sensitive");
    assert(evalThisWeek.shouldUseWebSearch === true, "'What happened this week?' triggers web search");
    assert(evalThisWeek.suggestedTimeRange === "week", "'What happened this week?' suggests time_range 'week'");

    const evalBamboo = evaluateFreshness("give me a break down of what happen to bamboo recently, search the web to give me the recent happening", ctx);
    assert(evalBamboo.isTimeSensitive === true, "Bamboo recent query is detected as time-sensitive");
    assert(evalBamboo.shouldUseWebSearch === true, "Bamboo recent query triggers web search");

    const evalEvergreen = evaluateFreshness("Explain how quicksort works in computer science", ctx);
    assert(evalEvergreen.isTimeSensitive === false, "Quicksort algorithm explanation is evergreen");
    assert(evalEvergreen.isPureDateQuery === false, "Quicksort is not a pure date query");

    // ─── Test 4: Publication Date & Recency Reranking ────────────────────────
    console.log("\n--- Test 4: Publication Date & Recency Reranking ---");

    const recentScore = computeFreshnessScore(
        `${ctx.year}-09-15T12:00:00Z`,
        "https://techcrunch.com/2026/09/bamboo-update",
        "Sample article content",
        true,
        ctx.year
    );

    const staleScore = computeFreshnessScore(
        "2024-07-10T12:00:00Z",
        "https://techcrunch.com/2024/07/bamboo-update",
        "Sample article content",
        true,
        ctx.year
    );

    assert(recentScore > staleScore, `Recent source freshness (${recentScore}) > stale 2024 source (${staleScore})`);

    // Execute rerank tool with both sources
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rerankExecution: any = await sourceRerankTool.execute!({
        query: "What is the latest update about Bamboo?",
        sources: [
            {
                title: "BambooHR 2024 Feature Drop",
                url: "https://bamboohr.com/blog/2024/update",
                content: "BambooHR updates from July 2024 including old hiring features.",
                publishedDate: "2024-07-15",
                score: 0,
            },
            {
                title: `BambooHR ${ctx.year} New Security and Platform Upgrades`,
                url: `https://bamboohr.com/blog/${ctx.year}/update`,
                content: `BambooHR updates for ${ctx.year} including latest product releases.`,
                publishedDate: `${ctx.year}-09-10`,
                score: 0,
            },
        ],
        topK: 2,
    }, {} as any);

    assert(rerankExecution.ranked.length === 2, "Reranker returned 2 sources");
    assert(
        rerankExecution.ranked[0].title.includes(String(ctx.year)),
        `Reranker prioritized ${ctx.year} source at rank 1 (rank 1 score: ${rerankExecution.ranked[0].finalScore}, rank 2 score: ${rerankExecution.ranked[1].finalScore})`
    );

    // ─── Test 5: Dynamic Agent Instructions Anchoring ─────────────────────────
    console.log("\n--- Test 5: Dynamic Agent Instructions Anchoring ---");

    const reqCtx = new RequestContext();
    reqCtx.set("timezone", "Africa/Lagos");
    const dynamicInstructions = await glukAgent.getInstructions({ requestContext: reqCtx });
    const instructionsStr = typeof dynamicInstructions === "string" ? dynamicInstructions : JSON.stringify(dynamicInstructions);

    assert(instructionsStr.includes(String(ctx.year)), `Instructions contain current year ${ctx.year}`);
    assert(instructionsStr.includes(ctx.formattedDate), `Instructions contain current date "${ctx.formattedDate}"`);
    assert(instructionsStr.includes("Africa/Lagos"), "Instructions contain Africa/Lagos timezone");
    assert(instructionsStr.includes("NEVER use pre-training cutoff dates"), "Instructions forbid pre-training cutoff dates");

    // ─── Test 6: Agent End-to-End Response Tests ──────────────────────────────
    console.log("\n--- Test 6: Agent End-to-End Response Tests ---");

    // 6a. "What's today's date?"
    console.log("  Executing query: \"What's today's date?\"...");
    const dateResponse = await glukAgent.generate("What's today's date?", {
        requestContext: reqCtx,
        modelSettings: { maxOutputTokens: 200 },
    });
    console.log(`  Agent response:\n  "${dateResponse.text.trim()}"`);
    assert(
        dateResponse.text.includes(String(ctx.year)),
        `Agent answered with current year ${ctx.year}`
    );
    assert(
        !dateResponse.text.includes("September 18, 2024") && !dateResponse.text.includes("2024"),
        "Agent did NOT use stale 2024 LLM training knowledge"
    );
    assert(
        dateResponse.text.toLowerCase().includes(ctx.monthName.toLowerCase()),
        `Agent mentioned current month (${ctx.monthName})`
    );

    // 6b. "What day is it?"
    console.log("\n  Executing query: \"What day is it?\"...");
    const dayResponse = await glukAgent.generate("What day is it?", {
        requestContext: reqCtx,
        modelSettings: { maxOutputTokens: 200 },
    });
    console.log(`  Agent response:\n  "${dayResponse.text.trim()}"`);
    assert(
        dayResponse.text.toLowerCase().includes(ctx.dayOfWeek.toLowerCase()),
        `Agent correctly identified current day of week (${ctx.dayOfWeek})`
    );

    // 6c. "What happened today?" (verification of temporal awareness)
    console.log("\n  Executing query: \"What happened today?\" (verifying temporal anchoring)...");
    const todayEventResponse = await glukAgent.generate(
        "What happened today? State today's date and give a brief 1-sentence note of what date you are grounding to.",
        {
            requestContext: reqCtx,
            modelSettings: { maxOutputTokens: 300 },
        }
    );
    console.log(`  Agent response:\n  "${todayEventResponse.text.trim()}"`);
    assert(
        todayEventResponse.text.includes(String(ctx.year)),
        `Grounding for 'today' references current year ${ctx.year}`
    );

    // 6d. "What happened this week?" (verification of temporal window)
    console.log("\n  Executing query: \"What happened this week?\"...");
    const weekResponse = await glukAgent.generate(
        "What happened this week? In 2 sentences, specify the date range for 'this week' and confirm the calendar year.",
        {
            requestContext: reqCtx,
            modelSettings: { maxOutputTokens: 300 },
        }
    );
    console.log(`  Agent response:\n  "${weekResponse.text.trim()}"`);
    assert(
        weekResponse.text.includes(String(ctx.year)),
        `'This week' references current year ${ctx.year}`
    );

    // 6e. "What is the latest information about X?"
    console.log("\n  Executing query: \"What is the latest information about artificial intelligence?\"...");
    const latestResponse = await glukAgent.generate(
        "What is the latest information about artificial intelligence? In 2 sentences, what year are you treating as the current year?",
        {
            requestContext: reqCtx,
            modelSettings: { maxOutputTokens: 300 },
        }
    );
    console.log(`  Agent response:\n  "${latestResponse.text.trim()}"`);
    assert(
        latestResponse.text.includes(String(ctx.year)),
        `'Latest' query explicitly anchors to year ${ctx.year}`
    );

    // ─── Summary ──────────────────────────────────────────────────────────────
    console.log("\n========================================================");
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("========================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error("Test execution failed with error:", err);
    process.exit(1);
});
