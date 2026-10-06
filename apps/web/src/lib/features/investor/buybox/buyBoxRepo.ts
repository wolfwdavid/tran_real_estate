// Buy boxes (INV-04) on top of Phase 4's alerts model (04-19), like renter saved searches (06-20).
//
// A buy box is TWO rows sharing one id, written in one Dexie transaction:
//   - the Phase 4 saved search (portal 'investor', endpoint 'sale-listings', the FETCH-WIDE request
//     for the location: Active + limit 500, no price/beds/type params). Phase 4 owns its name,
//     lastRunAt/lastSeenAt, claims and snapshot, and the ONE check-on-open scheduler re-runs it at
//     most once per 24 hours. Two buy boxes in the same place share one canonical request key, so
//     one call (and its cache entry) serves both.
//   - the buyBoxes criteria row (criteria, targets, expense assumption), a Phase 3 Syncable record.
// Both tables are in the backup.
//
// Price, beds and type are applied LOCALLY to the cached for-sale rows (matches.ts filterListings),
// at 0 calls. Only checkNow spends: one call through the investor port's requestSpend (fresh cache:
// 0 calls; past the cap: the runtime's CapPrompt asks). Nothing here calls fetch.
//
// Callers pass plain data ($state.snapshot before a write). Call from onMount / event handlers.
import { newSyncable, tombstone, type Syncable } from '@tran/core';
import { buildSnapshot, type ObservedItem, type SnapshotLike } from '@tran/core/alerts';
import { BUY_BOX_EXPENSE_BPS, type BuyBoxTargets } from '@tran/core/finance';
import { normalizeLocation } from '@tran/core/location';
import { getDb, type TranDb } from '$lib/storage/db';
import {
	saleListingsRequest,
	savedSearchRepo,
	useInvestorPort,
	type InvestorDataPort,
	type SaleListing,
	type SavedSearchRepo
} from '../data/investor-port';
import { INVESTOR_RECORD_SCHEMA_VERSION } from '../deals/tables';
import { filterListings } from './matches';

export type BuyBoxPropertyType =
	'Single Family' | 'Condo' | 'Townhouse' | 'Multi-Family' | 'Manufactured';

export const BUY_BOX_PROPERTY_TYPES: readonly BuyBoxPropertyType[] = Object.freeze([
	'Single Family',
	'Condo',
	'Townhouse',
	'Multi-Family',
	'Manufactured'
]);

export interface BuyBoxCriteria {
	location: string;
	minPriceCents: number | null;
	maxPriceCents: number | null;
	/** 0 = Any; 4 = 4 or more. */
	minBeds: 0 | 1 | 2 | 3 | 4;
	/** [] = any type. */
	propertyTypes: BuyBoxPropertyType[];
}

export interface BuyBoxInput {
	name: string;
	criteria: BuyBoxCriteria;
	targets: BuyBoxTargets;
	expenseBps: number;
}

export interface BuyBoxView extends BuyBoxInput {
	id: string;
	/** When the box was last checked (scheduler or Check now); null = never. */
	lastRunAt: number | null;
	lastSeenAt: number | null;
	createdAt: number;
	updatedAt: number;
}

/** Stable codes; the UI (07-18) maps them to copy. */
export type BuyBoxError =
	'name-empty' | 'location-empty' | 'location-unrecognized' | 'min-over-max';

/** The buyBoxes row: the saved search's companion (same id). */
export interface BuyBoxRecord extends Syncable {
	criteria: BuyBoxCriteria;
	targets: BuyBoxTargets;
	expenseBps: number;
}

export function validateBuyBox(input: BuyBoxInput): BuyBoxError[] {
	const out: BuyBoxError[] = [];
	if (input.name.trim() === '') out.push('name-empty');
	const loc = input.criteria.location.trim();
	if (loc === '') out.push('location-empty');
	else if (!normalizeLocation(loc).ok) out.push('location-unrecognized');
	const { minPriceCents: min, maxPriceCents: max } = input.criteria;
	if (min !== null && max !== null && min > max) out.push('min-over-max');
	return out;
}

export class BuyBoxValidationError extends Error {
	constructor(readonly errors: BuyBoxError[]) {
		super(`buy-box-invalid:${errors.join(',')}`);
		this.name = 'BuyBoxValidationError';
	}
}

export class BuyBoxNotFoundError extends Error {
	constructor(readonly id: string) {
		super('buy-box-not-found');
		this.name = 'BuyBoxNotFoundError';
	}
}

export interface BuyBoxRepoDeps {
	/** The app database (holds savedSearches, searchSnapshots and buyBoxes). Resolved lazily. */
	db: () => TranDb;
	/** Phase 4 saved-search repo over the SAME database. Resolved lazily. */
	phase4: () => SavedSearchRepo;
	port: Pick<InvestorDataPort, 'saleListings' | 'peekSaleListings'>;
	clock: () => number;
}

export interface BuyBoxRepo {
	createBuyBox(input: BuyBoxInput): Promise<BuyBoxView>;
	updateBuyBox(id: string, input: BuyBoxInput): Promise<BuyBoxView>;
	deleteBuyBox(id: string): Promise<void>;
	listBuyBoxes(): Promise<BuyBoxView[]>;
	getBuyBox(id: string): Promise<BuyBoxView | null>;
	/** Click handlers only: one call (0 when the request is fresh in cache), then the new count. */
	checkNow(id: string): Promise<{ newCount: number }>;
	/** The user opened the matches: "new since last visit" resets. */
	markSeen(id: string): Promise<void>;
	/** New since last visit AND matching the criteria (cached rows only, 0 calls). */
	newMatchIds(id: string): Promise<Set<string>>;
	newMatchCount(id: string): Promise<number>;
}

const iso = (t: number) => new Date(t).toISOString();

/** A clean copy of the input (trimmed name/location, sorted unique types, no stray keys). */
function cleanInput(i: BuyBoxInput): BuyBoxInput {
	return {
		name: i.name.trim(),
		criteria: {
			location: i.criteria.location.trim().replace(/\s+/g, ' '),
			minPriceCents: i.criteria.minPriceCents,
			maxPriceCents: i.criteria.maxPriceCents,
			minBeds: i.criteria.minBeds,
			propertyTypes: [...new Set(i.criteria.propertyTypes)].sort()
		},
		targets: {
			minCapRatePct: i.targets.minCapRatePct,
			minRentToPricePct: i.targets.minRentToPricePct
		},
		expenseBps: i.expenseBps
	};
}

function assertValid(input: BuyBoxInput): BuyBoxInput {
	const errors = validateBuyBox(input);
	if (errors.length > 0) throw new BuyBoxValidationError(errors);
	if (!Number.isInteger(input.expenseBps) || input.expenseBps < 0 || input.expenseBps > 10_000)
		throw new RangeError('expenseBps must be an integer between 0 and 10000');
	return cleanInput(input);
}

/** The saved search's stored params: the fetch-wide sale-listings request for the location. */
function storedParams(location: string) {
	return { ...saleListingsRequest(location).params } as Record<string, string | number>;
}

const sameParams = (a: Record<string, unknown>, b: Record<string, unknown>) =>
	JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/** What the scheduler's snapshot records for a cached sale listing (dollars, like Phase 4). */
const observedOf = (listings: readonly SaleListing[]): ObservedItem[] =>
	listings.map((l) => ({
		id: l.id,
		price: l.priceCents / 100,
		// The request asks for Active listings only.
		status: 'Active',
		removedDate: null
	}));

const isOffMarket = (i: { status: string | null; removedDate: string | null }) =>
	i.status === 'Inactive' || i.removedDate !== null;

export function createBuyBoxRepo(deps: BuyBoxRepoDeps): BuyBoxRepo {
	const { port, clock } = deps;

	type Phase4Row = Awaited<ReturnType<SavedSearchRepo['list']>>[number];

	function view(row: Phase4Row, rec: BuyBoxRecord): BuyBoxView {
		return {
			id: row.id,
			name: row.name,
			criteria: structuredClone(rec.criteria),
			targets: { ...rec.targets },
			expenseBps: rec.expenseBps,
			lastRunAt: row.lastRunAt,
			lastSeenAt: row.lastSeenAt,
			createdAt: Date.parse(rec.createdAt),
			updatedAt: Math.max(Date.parse(rec.updatedAt), Date.parse(row.updatedAt))
		};
	}

	async function liveRecord(id: string): Promise<BuyBoxRecord | undefined> {
		const rec = (await deps.db().buyBoxes.get(id)) as BuyBoxRecord | undefined;
		return rec && rec.deletedAt === undefined ? rec : undefined;
	}

	async function find(id: string): Promise<{ row: Phase4Row; rec: BuyBoxRecord } | undefined> {
		const row = (await deps.phase4().list()).find((r) => r.id === id && r.portal === 'investor');
		const rec = row ? await liveRecord(id) : undefined;
		return row && rec ? { row, rec } : undefined;
	}

	async function mustView(id: string): Promise<BuyBoxView> {
		const f = await find(id);
		if (!f) throw new BuyBoxNotFoundError(id);
		return view(f.row, f.rec);
	}

	async function newIdsFor(
		row: Phase4Row,
		rec: BuyBoxRecord,
		listings?: readonly SaleListing[]
	): Promise<Set<string>> {
		const out = new Set<string>();
		if (row.lastSeenAt === null) return out;
		const snap = await deps.phase4().snapshot(row.id);
		if (!snap) return out;
		const rows = listings ?? (await port.peekSaleListings(rec.criteria.location))?.listings ?? [];
		const matching = new Set(filterListings(rows, rec.criteria).map((l) => l.id));
		for (const [id, item] of Object.entries(snap.items)) {
			if (item.firstSeenAt > row.lastSeenAt && !isOffMarket(item) && matching.has(id)) out.add(id);
		}
		return out;
	}

	return {
		async createBuyBox(raw) {
			const input = assertValid(raw);
			const db = deps.db();
			const phase4 = deps.phase4();
			const id = await db.transaction('rw', db.savedSearches, db.buyBoxes, async () => {
				const row = await phase4.create({
					portal: 'investor',
					name: input.name,
					endpoint: 'sale-listings',
					params: storedParams(input.criteria.location)
				});
				const rec: BuyBoxRecord = {
					...newSyncable({
						id: row.id,
						now: new Date(clock()),
						schemaVersion: INVESTOR_RECORD_SCHEMA_VERSION
					}),
					criteria: input.criteria,
					targets: input.targets,
					expenseBps: input.expenseBps
				};
				await db.buyBoxes.add(rec);
				return row.id;
			});
			return mustView(id);
		},

		async updateBuyBox(id, raw) {
			const input = assertValid(raw);
			const db = deps.db();
			const phase4 = deps.phase4();
			await db.transaction('rw', db.savedSearches, db.searchSnapshots, db.buyBoxes, async () => {
				const found = await find(id);
				if (!found) throw new BuyBoxNotFoundError(id);
				const now = clock();
				if (found.row.name !== input.name) await phase4.rename(id, input.name);
				const params = storedParams(input.criteria.location);
				if (!sameParams(found.row.params, params)) {
					// New geography: the old snapshot describes other listings. Due at once again.
					await db.savedSearches.update(id, {
						params,
						lastRunAt: null,
						claimedAt: null,
						updatedAt: iso(now)
					});
					await db.searchSnapshots.delete(id);
				}
				const rec: BuyBoxRecord = {
					...found.rec,
					criteria: input.criteria,
					targets: input.targets,
					expenseBps: input.expenseBps,
					updatedAt: iso(now)
				};
				await db.buyBoxes.put(rec);
			});
			return mustView(id);
		},

		async deleteBuyBox(id) {
			const db = deps.db();
			const phase4 = deps.phase4();
			await db.transaction('rw', db.savedSearches, db.searchSnapshots, db.buyBoxes, async () => {
				await phase4.remove(id);
				await db.searchSnapshots.delete(id);
				const rec = await liveRecord(id);
				if (rec) await db.buyBoxes.put(tombstone(rec, new Date(clock())));
			});
		},

		async listBuyBoxes() {
			const rows = (await deps.phase4().list()).filter((r) => r.portal === 'investor');
			const out: BuyBoxView[] = [];
			for (const row of rows) {
				const rec = await liveRecord(row.id);
				if (rec) out.push(view(row, rec));
			}
			return out.sort(
				(a, b) =>
					a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id)
			);
		},

		async getBuyBox(id) {
			const f = await find(id);
			return f ? view(f.row, f.rec) : null;
		},

		async checkNow(id) {
			const found = await find(id);
			if (!found) throw new BuyBoxNotFoundError(id);
			const phase4 = deps.phase4();
			const res = await port.saleListings(found.rec.criteria.location);
			const prev = ((await phase4.snapshot(id)) ?? null) as SnapshotLike | null;
			// takenAt = when the data was fetched, so the scheduler re-runs 24 h after that (06-20).
			const next = buildSnapshot(prev, observedOf(res.listings), {
				takenAt: res.provenance.fetchedAt,
				truncated: res.truncated
			});
			await phase4.complete(id, next);
			const after = await find(id);
			if (!after) return { newCount: 0 };
			return { newCount: (await newIdsFor(after.row, after.rec, res.listings)).size };
		},

		async markSeen(id) {
			await deps.phase4().markSeen(id);
		},

		async newMatchIds(id) {
			const f = await find(id);
			return f ? newIdsFor(f.row, f.rec) : new Set();
		},

		async newMatchCount(id) {
			const f = await find(id);
			return f ? (await newIdsFor(f.row, f.rec)).size : 0;
		}
	};
}

/** Default criteria for a new buy box form. */
export function emptyBuyBox(): BuyBoxInput {
	return {
		name: '',
		criteria: {
			location: '',
			minPriceCents: null,
			maxPriceCents: null,
			minBeds: 0,
			propertyTypes: []
		},
		targets: { minCapRatePct: null, minRentToPricePct: null },
		expenseBps: BUY_BOX_EXPENSE_BPS
	};
}

/**
 * The app instance. The investor port reads the data runtime from Svelte context, so call this
 * during component initialisation; the database is opened lazily, on the first method call.
 */
export function useBuyBoxRepo(): BuyBoxRepo {
	return createBuyBoxRepo({
		db: () => getDb(),
		phase4: () => savedSearchRepo(),
		port: useInvestorPort(),
		clock: () => Date.now()
	});
}
