/**
 * Core runtime system clock source for Gluk.
 * Provides timezone-aware temporal context derived strictly from the server/system clock.
 */

export const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || "Africa/Lagos";

export interface TemporalContext {
    /** JavaScript Date instance representing the exact current moment */
    now: Date;
    /** ISO 8601 timestamp string in target timezone offset */
    iso: string;
    /** Full readable date string: e.g. "Friday, September 18, 2026" */
    dateString: string;
    /** Standard date string: e.g. "September 18, 2026" */
    formattedDate: string;
    /** YYYY-MM-DD formatted string: e.g. "2026-09-18" */
    calendarDate: string;
    /** Time string with AM/PM: e.g. "10:25 AM" */
    formattedTime: string;
    /** Full date and time with timezone abbreviation: e.g. "September 18, 2026, 10:25 AM WAT" */
    formattedDateTime: string;
    /** Full four-digit calendar year: e.g. 2026 */
    year: number;
    /** Month number (1-12): e.g. 9 */
    month: number;
    /** Full English month name: e.g. "September" */
    monthName: string;
    /** Day of month (1-31): e.g. 18 */
    day: number;
    /** Full day of week name: e.g. "Friday" */
    dayOfWeek: string;
    /** IANA timezone identifier: e.g. "Africa/Lagos" */
    timezone: string;
    /** UTC offset string: e.g. "+01:00" */
    utcOffset: string;
}

/**
 * Returns formatted temporal context for the given timezone (defaults to Africa/Lagos)
 * derived from the runtime system clock.
 */
export function getSystemTemporalContext(
    timeZone: string = DEFAULT_TIMEZONE,
    referenceDate: Date = new Date()
): TemporalContext {
    const tz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE;

    // Use Intl.DateTimeFormat to compute timezone-accurate calendar fields
    const dtfFull = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
        timeZoneName: "short",
    });

    const parts = dtfFull.formatToParts(referenceDate);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
        partMap[p.type] = p.value;
    }

    const year = parseInt(partMap.year, 10);
    const monthName = partMap.month;
    const day = parseInt(partMap.day, 10);
    const dayOfWeek = partMap.weekday;
    const tzName = partMap.timeZoneName || "WAT";

    // Numeric month 1-12
    const dtfMonth = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "numeric" });
    const month = parseInt(dtfMonth.format(referenceDate), 10);

    const pad = (n: number) => n.toString().padStart(2, "0");
    const calendarDate = `${year}-${pad(month)}-${pad(day)}`;
    const formattedDate = `${monthName} ${day}, ${year}`;
    const dateString = `${dayOfWeek}, ${formattedDate}`;
    const formattedTime = `${partMap.hour}:${partMap.minute} ${partMap.dayPeriod || ""}`.trim();
    const formattedDateTime = `${formattedDate}, ${formattedTime} ${tzName}`.trim();

    const utcOffset = getTimezoneOffsetString(referenceDate, tz);

    const rawHour = parseInt(partMap.hour, 10);
    let hour24 = rawHour;
    if (partMap.dayPeriod === "PM" && rawHour < 12) hour24 += 12;
    if (partMap.dayPeriod === "AM" && rawHour === 12) hour24 = 0;

    const iso = `${calendarDate}T${pad(hour24)}:${pad(parseInt(partMap.minute, 10))}:${pad(parseInt(partMap.second, 10))}${utcOffset}`;

    return {
        now: referenceDate,
        iso,
        dateString,
        formattedDate,
        calendarDate,
        formattedTime,
        formattedDateTime,
        year,
        month,
        monthName,
        day,
        dayOfWeek,
        timezone: tz,
        utcOffset,
    };
}

function isValidTimezone(tz: string): boolean {
    if (!tz || typeof tz !== "string") return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

function getTimezoneOffsetString(date: Date, timeZone: string): string {
    try {
        const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
        const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
        const diffMinutes = Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
        const sign = diffMinutes >= 0 ? "+" : "-";
        const absMinutes = Math.abs(diffMinutes);
        const hours = Math.floor(absMinutes / 60);
        const minutes = absMinutes % 60;
        return `${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    } catch {
        return "+01:00"; // Default Lagos WAT
    }
}
