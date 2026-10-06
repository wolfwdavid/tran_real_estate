// Local calendar dates for the agent portal. Every function reads the runtime's LOCAL time zone
// through the local getters (getFullYear/getMonth/getDate). A 'YYYY-MM-DD' string is never handed
// to the Date constructor directly: that parses as UTC midnight and shows the previous day west of
// Greenwich. Intl formatters are built per call so they always see the current zone.

const DAY_MS = 86_400_000;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' of the local calendar day. A string argument is an ISO timestamp. */
export function localDateOf(d: Date | string): string {
	const date = typeof d === 'string' ? new Date(d) : d;
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today's local calendar date as 'YYYY-MM-DD'. */
export function todayLocal(now: Date = new Date()): string {
	return localDateOf(now);
}

/** Local midnight of a 'YYYY-MM-DD' calendar date. */
export function parseLocalDate(ymd: string): Date {
	const m = YMD.exec(ymd);
	if (!m) throw new RangeError(`Not a YYYY-MM-DD date: ${ymd}`);
	return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** A calendar date ('YYYY-MM-DD') stays local; anything else is an ISO timestamp. */
function toLocalDate(isoOrYmd: string): Date {
	return YMD.test(isoOrYmd) ? parseLocalDate(isoOrYmd) : new Date(isoOrYmd);
}

const fmt = (d: Date, options: Intl.DateTimeFormatOptions): string =>
	new Intl.DateTimeFormat('en-US', options).format(d);

/** 'Oct 4' */
export function formatMonDay(ymd: string): string {
	return fmt(toLocalDate(ymd), { month: 'short', day: 'numeric' });
}

/** 'Oct 4, 2026' */
export function formatMonDayYear(isoOrYmd: string): string {
	return fmt(toLocalDate(isoOrYmd), { month: 'short', day: 'numeric', year: 'numeric' });
}

/** 'Sunday, October 4' */
export function formatWeekdayLong(ymd: string): string {
	return fmt(toLocalDate(ymd), { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Same local day: 'Today at 3:42 PM'. Any other day: 'Oct 2'. */
export function formatActivityTime(iso: string, now: Date = new Date()): string {
	const at = new Date(iso);
	if (localDateOf(at) === localDateOf(now)) {
		// ICU puts a narrow no-break space before AM/PM; normalise it so copy and tests match.
		const time = fmt(at, { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, ' ');
		return `Today at ${time}`;
	}
	return fmt(at, { month: 'short', day: 'numeric' });
}

/** Whole local calendar days from `iso` to `now` (DST-safe: compares local midnights). */
function calendarDaysBetween(iso: string, now: Date): number {
	const from = parseLocalDate(localDateOf(toLocalDate(iso)));
	const to = parseLocalDate(localDateOf(now));
	return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** 'today', 'yesterday' or '{n} days ago' (future dates read as 'today'). */
export function relativeDays(iso: string, now: Date = new Date()): string {
	const days = calendarDaysBetween(iso, now);
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	return `${days} days ago`;
}
