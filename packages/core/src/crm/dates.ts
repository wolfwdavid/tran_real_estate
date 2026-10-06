// Pure calendar math on local calendar dates written as YYYY-MM-DD strings.
//
// A due date is a calendar day, not an instant, so it is never parsed with the Date string
// parser (which reads date-only strings as UTC midnight and shifts them a day in the Americas).
// Arithmetic runs on Date.UTC over the Y/M/D parts, which has no DST transitions, and the result
// is formatted back from the UTC parts. YYYY-MM-DD strings compare correctly as plain strings.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function parts(s: string): [number, number, number] | null {
	const m = ISO_DATE.exec(s);
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	const t = new Date(Date.UTC(y, mo - 1, d));
	if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
	return [y, mo, d];
}

const pad = (n: number, w: number) => String(n).padStart(w, '0');

/** True for a real calendar date in strict YYYY-MM-DD form. */
export function isIsoDate(s: string): boolean {
	return parts(s) !== null;
}

/** The calendar date n days after (or before, for negative n) the given YYYY-MM-DD date. */
export function addDays(date: string, n: number): string {
	const p = parts(date);
	if (!p) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
	const t = new Date(Date.UTC(p[0], p[1] - 1, p[2]) + n * DAY_MS);
	return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1, 2)}-${pad(t.getUTCDate(), 2)}`;
}
