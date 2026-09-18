/**
 * Freshness policy and query intent classifier for Gluk.
 * Determines whether a query is a direct date/time inquiry, a time-sensitive
 * research query requiring live web search, or an evergreen topic.
 */

import { TemporalContext, getSystemTemporalContext } from "./system-clock";
import {
    ResolvedTemporalQuery,
    resolveQueryTemporalExpressions,
    TavilyTimeRange,
} from "./relative-resolver";

export interface FreshnessEvaluation {
    /** True if the user is asking strictly about the calendar date, time, or day */
    isPureDateQuery: boolean;
    /** True if the query asks for current, recent, breaking, or date-anchored information */
    isTimeSensitive: boolean;
    /** True if web search should be explicitly triggered */
    shouldUseWebSearch: boolean;
    /** The temporal resolution of any relative expressions found in the query */
    temporalResolution: ResolvedTemporalQuery;
    /** Suggested Tavily time_range parameter (day, week, month, year) */
    suggestedTimeRange?: TavilyTimeRange;
    /** Explanation for why this policy was selected */
    reason: string;
}

// Patterns for direct inquiries about the calendar date, day, or time
const PURE_DATE_PATTERNS = [
    /^what('s| is) (today'?s? date|the date( today)?)\??$/i,
    /^what date is it( today)?\??$/i,
    /^what day is it( today)?\??$/i,
    /^what day of the week is it( today)?\??$/i,
    /^what('s| is) the current date\??$/i,
    /^what year is (it|this)\??$/i,
    /^what('s| is) the (current )?year\??$/i,
    /^what('s| is) (the )?time( right now)?\??$/i,
    /^tell me today'?s? date\??$/i,
    /^today'?s? date\??$/i,
    /^date today\??$/i,
    /^current date and time\??$/i,
];

// Keywords indicating a time-sensitive query requiring fresh live information
const FRESHNESS_KEYWORDS = [
    "today", "yesterday", "this week", "last week", "this month",
    "latest", "recent", "recently", "breaking", "newest", "current",
    "up to date", "up-to-date", "right now", "just happened",
    "developments", "updates", "news about", "happened to", "what happened",
    "current version", "current state", "who is the current", "latest on",
    "release notes", "new feature", "announcement",
];

// Rapidly evolving topics that should default to fresh search
const RAPIDLY_EVOLVING_TOPICS = [
    "ai", "llm", "gpt", "model", "anthropic", "openai", "deepseek", "gemini",
    "claude", "mistral", "nvidia", "stock", "crypto", "election", "war", "tariff",
];

/**
 * Checks if a message is purely asking for the current date, day, or time.
 */
export function isPureDateQuery(message: string): boolean {
    const trimmed = message.trim();
    if (PURE_DATE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return true;
    }
    const lower = trimmed.toLowerCase();
    if (
        (lower.includes("what is today") || lower.includes("what's today") || lower.includes("today's date")) &&
        (lower.includes("date") || lower.includes("day")) &&
        !lower.includes("happened") &&
        !lower.includes("news") &&
        !lower.includes("event")
    ) {
        return true;
    }
    return false;
}

/**
 * Evaluates a query to determine freshness requirements and search policies.
 */
export function evaluateFreshness(
    message: string,
    context: TemporalContext = getSystemTemporalContext()
): FreshnessEvaluation {
    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();

    // 1. Pure date/time query: Agent answers directly from system clock, no web search needed
    if (isPureDateQuery(trimmed)) {
        return {
            isPureDateQuery: true,
            isTimeSensitive: false,
            shouldUseWebSearch: false,
            temporalResolution: resolveQueryTemporalExpressions(trimmed, context),
            reason: "Pure date/time inquiry — answer directly using runtime system clock context",
        };
    }

    // 2. Resolve any temporal expressions in the query
    const temporalResolution = resolveQueryTemporalExpressions(trimmed, context);

    // 3. Detect time-sensitivity indicators
    const hasFreshnessKeyword = FRESHNESS_KEYWORDS.some((kw) => lower.includes(kw));
    const hasRapidlyEvolvingTopic = RAPIDLY_EVOLVING_TOPICS.some((topic) =>
        new RegExp(`\\b${topic}\\b`, "i").test(lower)
    );

    const isExplicitWebSearch =
        lower.includes("search the web") ||
        lower.includes("search online") ||
        lower.includes("google") ||
        lower.includes("browse the web");

    const isTimeSensitive =
        temporalResolution.hasTemporalExpression ||
        hasFreshnessKeyword ||
        hasRapidlyEvolvingTopic ||
        isExplicitWebSearch;

    let reason = "Evergreen query — standard processing";
    if (temporalResolution.hasTemporalExpression) {
        reason = `Temporal expression detected (${temporalResolution.expressionType || "temporal"}: ${temporalResolution.label})`;
    } else if (hasFreshnessKeyword) {
        reason = "Freshness keyword detected — time-sensitive live information required";
    } else if (hasRapidlyEvolvingTopic) {
        reason = "Fast-moving topic detected — live web search recommended";
    } else if (isExplicitWebSearch) {
        reason = "User explicitly requested live web search";
    }

    return {
        isPureDateQuery: false,
        isTimeSensitive,
        shouldUseWebSearch: isTimeSensitive,
        temporalResolution,
        suggestedTimeRange: temporalResolution.tavilyTimeRange,
        reason,
    };
}
