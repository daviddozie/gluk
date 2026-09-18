/**
 * Resolves relative temporal expressions (e.g., "today", "yesterday", "this week",
 * "last week", "this month", "recently", "latest", "current") against the actual
 * runtime system clock.
 */

import { TemporalContext, getSystemTemporalContext } from "./system-clock";

export type TavilyTimeRange = "day" | "week" | "month" | "year";

export interface DateWindow {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
    label: string;
}

export interface RelativeTimeWindows {
    today: DateWindow;
    yesterday: DateWindow;
    tomorrow: DateWindow;
    thisWeek: DateWindow;
    lastWeek: DateWindow;
    thisMonth: DateWindow;
    lastMonth: DateWindow;
    thisYear: DateWindow;
    recentWindow: DateWindow; // Past 30 days
}

export interface ResolvedTemporalQuery {
    hasTemporalExpression: boolean;
    expression?: string;
    expressionType?:
        | "today"
        | "yesterday"
        | "tomorrow"
        | "this_week"
        | "last_week"
        | "this_month"
        | "last_month"
        | "recent"
        | "current_year"
        | "explicit_year";
    tavilyTimeRange?: TavilyTimeRange;
    startDate?: string;
    endDate?: string;
    targetYear?: number;
    searchConstraint?: string;
    label?: string;
}

const pad = (n: number) => n.toString().padStart(2, "0");

function formatDateISO(d: Date, tz: string): string {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = dtf.formatToParts(d);
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const day = parts.find((p) => p.type === "day")?.value ?? "01";
    const y = parts.find((p) => p.type === "year")?.value ?? "2026";
    return `${y}-${m}-${day}`;
}

/**
 * Calculates concrete calendar windows for all relative temporal ranges
 * anchored to the runtime temporal context.
 */
export function getRelativeTimeWindows(context: TemporalContext): RelativeTimeWindows {
    const tz = context.timezone;
    const now = context.now;

    // Today
    const todayStr = context.calendarDate;
    const todayWindow: DateWindow = {
        start: todayStr,
        end: todayStr,
        label: `Today (${context.formattedDate})`,
    };

    // Yesterday
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = formatDateISO(yesterdayDate, tz);
    const yesterdayWindow: DateWindow = {
        start: yesterdayStr,
        end: yesterdayStr,
        label: `Yesterday (${yesterdayStr})`,
    };

    // Tomorrow
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = formatDateISO(tomorrowDate, tz);
    const tomorrowWindow: DateWindow = {
        start: tomorrowStr,
        end: tomorrowStr,
        label: `Tomorrow (${tomorrowStr})`,
    };

    // This week (Monday to Sunday)
    // Day of week: Sunday = 0, Monday = 1, ..., Saturday = 6
    const dayOfWeekIndex = (now.getUTCDay() + 6) % 7; // Monday = 0, ..., Sunday = 6
    const mondayMs = now.getTime() - dayOfWeekIndex * 24 * 60 * 60 * 1000;
    const sundayMs = mondayMs + 6 * 24 * 60 * 60 * 1000;
    const thisWeekStart = formatDateISO(new Date(mondayMs), tz);
    const thisWeekEnd = formatDateISO(new Date(sundayMs), tz);
    const thisWeekWindow: DateWindow = {
        start: thisWeekStart,
        end: thisWeekEnd,
        label: `This week (${thisWeekStart} to ${thisWeekEnd})`,
    };

    // Last week
    const lastMondayMs = mondayMs - 7 * 24 * 60 * 60 * 1000;
    const lastSundayMs = sundayMs - 7 * 24 * 60 * 60 * 1000;
    const lastWeekStart = formatDateISO(new Date(lastMondayMs), tz);
    const lastWeekEnd = formatDateISO(new Date(lastSundayMs), tz);
    const lastWeekWindow: DateWindow = {
        start: lastWeekStart,
        end: lastWeekEnd,
        label: `Last week (${lastWeekStart} to ${lastWeekEnd})`,
    };

    // This month (1st of month to last day of month)
    const thisMonthStart = `${context.year}-${pad(context.month)}-01`;
    const nextMonth = context.month === 12 ? 1 : context.month + 1;
    const nextMonthYear = context.month === 12 ? context.year + 1 : context.year;
    const daysInThisMonth = new Date(nextMonthYear, nextMonth - 1, 0).getDate();
    const thisMonthEnd = `${context.year}-${pad(context.month)}-${pad(daysInThisMonth)}`;
    const thisMonthWindow: DateWindow = {
        start: thisMonthStart,
        end: thisMonthEnd,
        label: `This month (${context.monthName} ${context.year})`,
    };

    // Last month
    const prevMonthNum = context.month === 1 ? 12 : context.month - 1;
    const prevMonthYear = context.month === 1 ? context.year - 1 : context.year;
    const daysInPrevMonth = new Date(context.year, context.month - 1, 0).getDate();
    const lastMonthStart = `${prevMonthYear}-${pad(prevMonthNum)}-01`;
    const lastMonthEnd = `${prevMonthYear}-${pad(prevMonthNum)}-${pad(daysInPrevMonth)}`;
    const lastMonthWindow: DateWindow = {
        start: lastMonthStart,
        end: lastMonthEnd,
        label: `Last month (${lastMonthStart} to ${lastMonthEnd})`,
    };

    // This year
    const thisYearWindow: DateWindow = {
        start: `${context.year}-01-01`,
        end: `${context.year}-12-31`,
        label: `Year ${context.year}`,
    };

    // Recent 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentStart = formatDateISO(thirtyDaysAgo, tz);
    const recentWindow: DateWindow = {
        start: recentStart,
        end: todayStr,
        label: `Recently (${recentStart} to ${todayStr})`,
    };

    return {
        today: todayWindow,
        yesterday: yesterdayWindow,
        tomorrow: tomorrowWindow,
        thisWeek: thisWeekWindow,
        lastWeek: lastWeekWindow,
        thisMonth: thisMonthWindow,
        lastMonth: lastMonthWindow,
        thisYear: thisYearWindow,
        recentWindow,
    };
}

/**
 * Parses a natural language query and resolves any relative or explicit temporal
 * expressions against the current runtime context.
 */
export function resolveQueryTemporalExpressions(
    query: string,
    context: TemporalContext = getSystemTemporalContext()
): ResolvedTemporalQuery {
    const lower = query.toLowerCase();
    const windows = getRelativeTimeWindows(context);

    // 1. "today", "today's", "tonight", "this morning"
    if (/\b(today|today's|tonight|this morning|this afternoon)\b/.test(lower)) {
        return {
            hasTemporalExpression: true,
            expression: "today",
            expressionType: "today",
            tavilyTimeRange: "day",
            startDate: windows.today.start,
            endDate: windows.today.end,
            targetYear: context.year,
            searchConstraint: `${context.formattedDate}`,
            label: windows.today.label,
        };
    }

    // 2. "yesterday", "yesterday's"
    if (/\b(yesterday|yesterday's)\b/.test(lower)) {
        return {
            hasTemporalExpression: true,
            expression: "yesterday",
            expressionType: "yesterday",
            tavilyTimeRange: "day",
            startDate: windows.yesterday.start,
            endDate: windows.yesterday.end,
            targetYear: context.year,
            searchConstraint: `date:${windows.yesterday.start}`,
            label: windows.yesterday.label,
        };
    }

    // 3. "tomorrow"
    if (/\b(tomorrow|tomorrow's)\b/.test(lower)) {
        return {
            hasTemporalExpression: true,
            expression: "tomorrow",
            expressionType: "tomorrow",
            startDate: windows.tomorrow.start,
            endDate: windows.tomorrow.end,
            targetYear: context.year,
            label: windows.tomorrow.label,
        };
    }

    // 4. "this week", "past week", "last 7 days", "past 7 days"
    if (/\b(this week|this week's|past week|last 7 days|past 7 days)\b/.test(lower)) {
        return {
            hasTemporalExpression: true,
            expression: "this week",
            expressionType: "this_week",
            tavilyTimeRange: "week",
            startDate: windows.thisWeek.start,
            endDate: windows.thisWeek.end,
            targetYear: context.year,
            searchConstraint: `after:${windows.thisWeek.start}`,
            label: windows.thisWeek.label,
        };
    }

    // 5. "last week", "previous week"
    if (/\b(last week|last week's|previous week)\b/.test(lower)) {
        return {
            hasTemporalExpression: true,
            expression: "last week",
            expressionType: "last_week",
            tavilyTimeRange: "week",
            startDate: windows.lastWeek.start,
            endDate: windows.lastWeek.end,
            targetYear: context.year,
            searchConstraint: `${windows.lastWeek.start} to ${windows.lastWeek.end}`,
            label: windows.lastWeek.label,
        };
    }

    // 6. "this month", "current month", "past 30 days", "last 30 days"
    if (/\b(this month|this month's|current month|past 30 days|last 30 days)\b/.test(lower)) {
        return {
            hasTemporalExpression: true,
            expression: "this month",
            expressionType: "this_month",
            tavilyTimeRange: "month",
            startDate: windows.thisMonth.start,
            endDate: windows.thisMonth.end,
            targetYear: context.year,
            searchConstraint: `${context.monthName} ${context.year}`,
            label: windows.thisMonth.label,
        };
    }

    // 7. "last month", "previous month"
    if (/\b(last month|last month's|previous month)\b/.test(lower)) {
        return {
            hasTemporalExpression: true,
            expression: "last month",
            expressionType: "last_month",
            tavilyTimeRange: "month",
            startDate: windows.lastMonth.start,
            endDate: windows.lastMonth.end,
            targetYear: context.year,
            searchConstraint: `after:${windows.lastMonth.start}`,
            label: windows.lastMonth.label,
        };
    }

    // 8. "recently", "recent", "latest", "breaking", "newest", "current", "right now", "just happened"
    if (/\b(recently|recent|latest|breaking|newest|current|now|right now|just happened|up to date|up-to-date)\b/.test(lower)) {
        return {
            hasTemporalExpression: true,
            expression: "recent",
            expressionType: "recent",
            tavilyTimeRange: "month",
            startDate: windows.recentWindow.start,
            endDate: windows.recentWindow.end,
            targetYear: context.year,
            searchConstraint: `${context.year}`,
            label: `Recent (${context.year})`,
        };
    }

    // 9. Explicit 4-digit year in query (e.g., 2024, 2025, 2026, 2027)
    const yearMatch = query.match(/\b(20[2-9][0-9])\b/);
    if (yearMatch) {
        const queryYear = parseInt(yearMatch[1], 10);
        return {
            hasTemporalExpression: true,
            expression: yearMatch[1],
            expressionType: queryYear === context.year ? "current_year" : "explicit_year",
            tavilyTimeRange: queryYear === context.year ? "year" : undefined,
            startDate: `${queryYear}-01-01`,
            endDate: `${queryYear}-12-31`,
            targetYear: queryYear,
            searchConstraint: `${queryYear}`,
            label: `Year ${queryYear}`,
        };
    }

    return {
        hasTemporalExpression: false,
    };
}
