// Renter result sorting (RENT-02). Sorting is local and free, like every renter filter, and it is
// fully deterministic: missing values always sort last, and equal keys tie-break by id ascending,
// so the same rows produce the same order no matter how the provider returned them.
import type { RentalRowLike } from './types.js';

/** Sort choices in UI order; ids are the `sort=` URL values, labels are UI-SPEC copy. */
export const SORT_OPTIONS = [
	{ id: 'newest', label: 'Newest listed' },
	{ id: 'rent-asc', label: 'Rent: low to high' },
	{ id: 'rent-desc', label: 'Rent: high to low' },
	{ id: 'beds', label: 'Most bedrooms' },
	{ id: 'size', label: 'Largest' },
	{ id: 'dom', label: 'Fewest days on market' }
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]['id'];

export const DEFAULT_SORT: SortId = 'newest';

const SORT_IDS: ReadonlySet<string> = new Set(SORT_OPTIONS.map((o) => o.id));

export function isSortId(v: unknown): v is SortId {
	return typeof v === 'string' && SORT_IDS.has(v);
}

const num = (n: number | null | undefined): number | null =>
	typeof n === 'number' && Number.isFinite(n) ? n : null;

const time = (iso: string | null | undefined): number | null => {
	if (typeof iso !== 'string') return null;
	const t = Date.parse(iso);
	return Number.isNaN(t) ? null : t;
};

type Key = (r: RentalRowLike) => number | null;

/** The sort key and its direction (1 ascending, -1 descending) for each option. */
const KEYS: Record<SortId, readonly [Key, 1 | -1]> = {
	newest: [(r) => time(r.listedDate), -1],
	'rent-asc': [(r) => num(r.price), 1],
	'rent-desc': [(r) => num(r.price), -1],
	beds: [(r) => num(r.bedrooms), -1],
	size: [(r) => num(r.squareFootage), -1],
	dom: [(r) => num(r.daysOnMarket), 1]
};

/** A sorted copy of `rows`; the input is never mutated. */
export function sortRentals<T extends RentalRowLike>(rows: readonly T[], sort: SortId): T[] {
	const [key, dir] = KEYS[sort] ?? KEYS[DEFAULT_SORT];
	// Decorate once so each key is computed a single time per row.
	const decorated = rows.map((row) => ({ row, k: key(row) }));
	decorated.sort((a, b) => {
		if (a.k !== b.k) {
			if (a.k === null) return 1; // nulls last in every direction
			if (b.k === null) return -1;
			return (a.k - b.k) * dir;
		}
		const x = a.row.id;
		const y = b.row.id;
		return x < y ? -1 : x > y ? 1 : 0;
	});
	return decorated.map((d) => d.row);
}
