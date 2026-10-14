// Calendar-day math shared by the renter filters and formatters. Kept apart from filters.ts so
// formatters (format.ts, used on the /tools/affordability/ marketing page) do not pull the search
// defaults and filter code into a 60 KB gz budget-gated page (10-14).

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Whole UTC calendar days from the date part of `iso` to `now`; NaN when `iso` has no date. */
export function utcDayDiff(now: Date, iso: string): number {
	const m = ISO_DATE.exec(iso);
	if (!m) return NaN;
	const listed = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return Math.round((today - listed) / DAY_MS);
}
