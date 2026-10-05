// Thin wrapper over the Storage API (persist / persisted / estimate). `nav` is injectable so the
// Node unit tests can pass a fake; app code relies on the default `navigator`.

export type PersistStatus = 'granted' | 'not-granted' | 'not-reported';

type Nav = { storage?: Partial<Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>> };

/** Navigators already known to be persisted this session, so we never prompt twice. */
const knownPersisted = new WeakSet<object>();

function toStatus(nav: Nav, granted: boolean): PersistStatus {
	if (granted) knownPersisted.add(nav);
	return granted ? 'granted' : 'not-granted';
}

/**
 * MUST be called synchronously at the top of a click handler, before any await (Firefox only
 * honours persist() with user activation). Call sites: Save key in remember mode, switching to
 * remember, Import Merge/Replace confirm, "Ask the browser again", and later phases' first repo
 * save. Deliberately not `async`: persist() is invoked on the first line, then chained.
 */
export function requestPersistence(nav: Nav = navigator): Promise<PersistStatus> {
	const p = knownPersisted.has(nav) ? undefined : nav.storage?.persist?.();
	if (knownPersisted.has(nav)) return Promise.resolve('granted');
	if (!p) return Promise.resolve('not-reported');
	return p.then(
		(granted) => toStatus(nav, granted),
		() => 'not-reported' as const
	);
}

export async function persistenceStatus(nav: Nav = navigator): Promise<PersistStatus> {
	if (!nav.storage?.persisted) return 'not-reported';
	try {
		return toStatus(nav, await nav.storage.persisted());
	} catch {
		return 'not-reported';
	}
}

export async function storageEstimate(
	nav: Nav = navigator
): Promise<{ usage: number; quota: number } | null> {
	if (!nav.storage?.estimate) return null;
	try {
		const e = await nav.storage.estimate();
		return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
	} catch {
		return null;
	}
}

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** "Space used" formatting: KB, MB or GB only, at most one decimal. */
export function formatBytes(n: number): string {
	if (n >= GB) return `${numberFormat.format(n / GB)} GB`;
	if (n >= MB) return `${numberFormat.format(n / MB)} MB`;
	return `${numberFormat.format(n / KB)} KB`;
}
