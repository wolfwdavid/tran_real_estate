// Shared reader for the first-party beacon collector (10-05, scripts/serve-pages.mjs). A plain
// module, not a spec.
//
// The collector's record is in-memory and shared by every Playwright worker, and every page load on
// the configured build sends a real beacon. So a spec never wipes the whole record: it tags its
// requests through the user agent and reads or resets only the entries carrying its tag.
import type { APIRequestContext } from '@playwright/test';

export interface BeaconRecord {
	body?: string;
	contentType?: string | null;
	cookie?: string | null;
	referer?: string | null;
	origin?: string | null;
	userAgent?: string | null;
	preflight?: true;
	at: number;
}

/** A unique user-agent tag for one test (worker pid + random suffix). */
export const beaconTag = (label: string): string =>
	`tran-${label}-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

/** The recorded entries (beacons and preflights) whose user agent contains `tag`. */
export async function beaconsFor(
	request: APIRequestContext,
	collector: string,
	tag: string
): Promise<BeaconRecord[]> {
	const all = (await (await request.get(`${collector}/__beacons`)).json()) as BeaconRecord[];
	return all.filter((b) => String(b.userAgent ?? '').includes(tag));
}

/** Removes only the entries whose user agent contains `tag`. */
export async function resetBeacons(
	request: APIRequestContext,
	collector: string,
	tag: string
): Promise<number> {
	const res = await request.post(`${collector}/__beacons/reset?ua=${encodeURIComponent(tag)}`);
	return res.status();
}
