import { formatDistanceStrict } from 'date-fns';

const MINUTE_MS = 60_000;
const WEEK_MS = 7 * 24 * 60 * MINUTE_MS;

export interface RelativeOptions {
	/** IANA zone for the date form (7 days or older). Defaults to the browser's zone. */
	timeZone?: string;
}

function yearIn(epochMs: number, timeZone: string | undefined): string {
	return new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone }).format(epochMs);
}

/**
 * The `{relative}` part of provenance copy (04-UI-SPEC): "just now" under a minute, a strict
 * distance ("5 minutes ago", "2 hours ago", "3 days ago") under 7 days, then "Sep 28" (plus the
 * year when it differs from `now`'s year). A fetchedAt in the future (clock skew) reads "just now".
 */
export function formatRelative(fetchedAt: number, now: number, opts: RelativeOptions = {}): string {
	const age = now - fetchedAt;
	if (age < MINUTE_MS) return 'just now';
	if (age < WEEK_MS) {
		return formatDistanceStrict(fetchedAt, now, { addSuffix: true, roundingMethod: 'floor' });
	}
	const { timeZone } = opts;
	const sameYear = yearIn(fetchedAt, timeZone) === yearIn(now, timeZone);
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: sameYear ? undefined : 'numeric',
		timeZone
	}).format(fetchedAt);
}

/** The `datetime` attribute value for a `<time>` element. */
export function toIso(epochMs: number): string {
	return new Date(epochMs).toISOString();
}
