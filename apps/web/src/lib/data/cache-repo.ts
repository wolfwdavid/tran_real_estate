// Response cache repository over the apiCache table (local-only, never backed up).
// Rows are keyed by the canonical request key; listing rows can also be searched by listing id
// so a detail view can be served from an earlier search without spending a call.
import { DAY_MS } from '@tran/core/request';
import type { DataDb } from './platform';
import type { ApiCacheRow } from './tables';

/** Endpoints whose cached bodies hold listing objects with an `id`. */
const LISTING_ENDPOINTS = ['rental-listings', 'sale-listings', 'rental-listing-by-id'] as const;

/** Default age after which cache rows are pruned. */
export const CACHE_MAX_AGE_MS = 60 * DAY_MS;

export interface CacheRepo {
	get(key: string): Promise<ApiCacheRow | undefined>;
	put(row: ApiCacheRow): Promise<void>;
	findListingById(id: string): Promise<{ row: ApiCacheRow; item: unknown } | undefined>;
	prune(now: number, maxAgeMs?: number): Promise<number>;
}

const hasId = (item: unknown, id: string): boolean =>
	typeof item === 'object' && item !== null && (item as { id?: unknown }).id === id;

export function createCacheRepo(db: DataDb): CacheRepo {
	return {
		get: (key) => db.apiCache.get(key),

		async put(row) {
			await db.apiCache.put(row);
		},

		async findListingById(id) {
			const rows = await db.apiCache
				.where('endpoint')
				.anyOf([...LISTING_ENDPOINTS])
				.toArray();
			rows.sort((a, b) => b.fetchedAt - a.fetchedAt);
			for (const row of rows) {
				const items: readonly unknown[] = Array.isArray(row.body) ? row.body : [row.body];
				const item = items.find((candidate) => hasId(candidate, id));
				if (item !== undefined) return { row, item };
			}
			return undefined;
		},

		prune: (now, maxAgeMs = CACHE_MAX_AGE_MS) =>
			db.apiCache
				.where('fetchedAt')
				.below(now - maxAgeMs)
				.delete()
	};
}
