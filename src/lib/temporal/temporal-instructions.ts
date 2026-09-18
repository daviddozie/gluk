/**
 * Dynamic system prompt builder for temporal grounding.
 * Generates an authoritative temporal context block anchored to the system clock
 * and instructs the agent to never rely on internal LLM pre-training cutoffs.
 */

import { TemporalContext, getSystemTemporalContext } from "./system-clock";
import { getRelativeTimeWindows } from "./relative-resolver";

/**
 * Builds the authoritative temporal grounding markdown block for system instructions.
 */
export function buildTemporalGroundingInstructions(
    context: TemporalContext = getSystemTemporalContext()
): string {
    const windows = getRelativeTimeWindows(context);

    return `## TEMPORAL GROUNDING & RUNTIME SYSTEM CLOCK (CRITICAL MANDATE)
You have an authoritative, real-time system clock provided below by the application runtime.

### Current System Time & Date:
- **Current Date & Day**: ${context.dateString}
- **Current Year**: ${context.year}
- **Current Month**: ${context.monthName} ${context.year}
- **Current Time**: ${context.formattedTime}
- **System Timezone**: ${context.timezone} (${context.utcOffset})
- **Full Timestamp**: ${context.formattedDateTime}

### Relative Date Anchors (Calculated against current runtime clock):
- **Today**: ${windows.today.start} (${context.dayOfWeek}, ${context.formattedDate})
- **Yesterday**: ${windows.yesterday.start}
- **Tomorrow**: ${windows.tomorrow.start}
- **This Week**: ${windows.thisWeek.start} to ${windows.thisWeek.end}
- **Last Week**: ${windows.lastWeek.start} to ${windows.lastWeek.end}
- **This Month**: ${windows.thisMonth.start} to ${windows.thisMonth.end} (${context.monthName} ${context.year})
- **Recent Window**: Past 30 days (${windows.recentWindow.start} to ${windows.today.end})

### STRICT TEMPORAL RULES:
1. **NEVER use pre-training cutoff dates**: Your pre-training data cutoff (e.g. 2024 or 2025) is OBSOLETE. The current calendar year is **${context.year}**. You must NEVER claim the current year is earlier than ${context.year}.
2. **Immediate Date Inquiries**: When asked "What's today's date?", "What day is it?", "What year is it?", or "What time is it?", state the answer immediately and authoritatively using the system clock above (**${context.formattedDate}**, **${context.dayOfWeek}**).
3. **Relative Temporal Expressions**: When the user says "today", "yesterday", "this week", "last week", "this month", "recently", "latest", or "current", you MUST resolve them against the calendar dates above (year ${context.year}).
4. **Time-Sensitive Research & Web Search**:
   - For questions about current events, breaking news, latest developments, or updates (e.g., "what happened today", "what happened this week", "latest in AI", "recent developments"), you MUST use \`webSearchTool\`.
   - Formulate search queries that reflect the current year (**${context.year}**) and relevant date constraints.
   - Pay close attention to the **published dates** of sources. Prioritize sources published within the requested time window and disregard or deprioritize outdated articles from prior years unless historical context is requested.`;
}
