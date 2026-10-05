// The DataGateway: the only way the app reads or spends RentCast calls (DATA-02..05).
//
// Reads are split from spends (04-RESEARCH Pattern 3). peek/peekListingById/estimate* read the
// cache only and never spend. get/refresh/rentalListingById may spend exactly one call, and only
// along this path: fresh cache → in-flight dedupe → serial queue → ledger.reserve (cap check and
// pending row in one transaction) → client.get → ledger.settle → cache.put. A cache hit returns
// the ORIGINAL fetchedAt, so every "as of" stamp the UI shows is honest.
//
// The cache stores the validated payload and maps on read (Pattern 9). 404/400 answers are cached
// as negative entries for 24h. Nothing here logs, and no error carries a response body or a key.
import {
	backoffMs,
	canonicalKey,
	classifyResponse,
	GatewayError,
	isStale,
	PROBE_REQUEST,
	type DataRequest,
	type EndpointId,
	type GatewayErrorDetail,
	type Provenance
} from '@tran/core/request';
import {
	buildListingByIdRequest,
	isTruncated,
	LISTINGS_LIMIT,
	type Listing
} from '@tran/core/listings';
import type { CacheRepo } from './cache-repo';
import { createFixtureFetch, type FixtureSet } from './fixtures/fixture-fetch';
import { issueGrant, type OverCapGrant } from './grants';
import type { LedgerRepo, UsageSnapshot } from './ledger-repo';
import { createRentCastClient, type RentCastClient } from './rentcast/client';
import { mapListing, mapPayload, type DomainData } from './rentcast/mappers';
import { testRentCastKey, type ProbeResult } from './rentcast/probe';
import { parsePayload, type ValidatedPayload } from './rentcast/schemas';
import type { ApiCacheRow, LedgerIntent } from './tables';

export interface GatewayResult<T = DomainData> {
	data: T;
	provenance: Provenance;
	truncated: boolean;
	droppedRows: number;
	requestKey: string;
}

export type PeekResult<T = DomainData> =
	{ kind: 'data'; result: GatewayResult<T> } | { kind: 'error'; error: GatewayError };

export interface CostEstimate {
	calls: number;
	reason: 'sample' | 'cached' | 'network';
}

export interface SpendOptions {
	intent?: 'user' | 'scheduler';
	grant?: OverCapGrant;
}

export class ReactiveSpendError extends Error {
	constructor() {
		super(
			'RentCast calls cannot be spent from a reactive context. Use gateway.peek() in views; spend only in event handlers or the scheduler.'
		);
		this.name = 'ReactiveSpendError';
	}
}

export interface DataGateway {
	readonly source: 'rentcast' | 'sample';
	/** Cache only, 0 calls. `undefined` when nothing is cached for this request. */
	peek<T = DomainData>(req: DataRequest): Promise<PeekResult<T> | undefined>;
	/** Cache only, 0 calls: a listing found inside any cached listings response. */
	peekListingById(id: string): Promise<{ listing: Listing; provenance: Provenance } | undefined>;
	estimateCost(req: DataRequest): Promise<CostEstimate>;
	estimateBatchCost(reqs: readonly DataRequest[]): Promise<CostEstimate>;
	/** Fresh cache or 1 call. Throws GatewayError (one taxonomy kind) or ReactiveSpendError. */
	get<T = DomainData>(req: DataRequest, opts?: SpendOptions): Promise<GatewayResult<T>>;
	/** Bypasses the TTL for this one request: always 1 call, still under the cap. */
	refresh<T = DomainData>(req: DataRequest, opts?: SpendOptions): Promise<GatewayResult<T>>;
	rentalListingById(id: string, opts?: SpendOptions): Promise<GatewayResult<Listing>>;
	/** A single-use permission for ONE call past the cap, bound to this request. */
	grantOverCap(req: DataRequest): OverCapGrant;
	testKey(key: string): Promise<ProbeResult>;
	usage(): Promise<UsageSnapshot>;
}

export interface LiveGatewayDeps {
	client: RentCastClient;
	cache: CacheRepo;
	ledger: LedgerRepo;
	clock: () => number;
	probeFetch: typeof fetch;
	/** True while a reactive tracking context ($effect/$derived) is running. */
	reactiveGuard?: () => boolean;
}

export interface SampleGatewayDeps {
	fixtures: FixtureSet;
	ledger: LedgerRepo;
	clock: () => number;
	/** The live fetch, used ONLY by testKey (a key test always targets RentCast). */
	probeFetch: typeof fetch;
	reactiveGuard?: () => boolean;
}

const LISTINGS_ENDPOINTS: ReadonlySet<EndpointId> = new Set(['rental-listings', 'sale-listings']);

const isNegative = (status: number): boolean => status === 404 || status === 400;

/** The page size a listings request asked for (RentCast default when absent). */
function limitOf(req: DataRequest): number {
	const limit = Number(req.params.limit);
	return Number.isInteger(limit) && limit > 0 ? limit : LISTINGS_LIMIT;
}

/** The NoResults detail kept on a negative cache row so a repeat throws the same error. */
function negativeDetail(row: ApiCacheRow): GatewayErrorDetail | undefined {
	const body = row.body as { detail?: GatewayErrorDetail } | null;
	return body?.detail;
}

/**
 * The validated body as stored in apiCache: the kept rows array for listings, the single row for
 * by-id, the object for estimates and markets. Same shape as the wire body, so cache-repo's
 * findListingById can search it, and mapping still happens on read.
 */
function storedBody(payload: ValidatedPayload): unknown {
	if ('rows' in payload) return payload.rows;
	if ('row' in payload) return payload.row;
	return payload.data;
}

/** Rebuilds the ValidatedPayload a cached 200 row was stored from. */
function payloadOf(row: ApiCacheRow): ValidatedPayload {
	const endpoint = row.endpoint as EndpointId;
	switch (endpoint) {
		case 'rental-listings':
		case 'sale-listings':
			return { endpoint, rows: Array.isArray(row.body) ? row.body : [] };
		case 'rental-listing-by-id':
			return { endpoint, row: row.body };
		default:
			return { endpoint, data: row.body };
	}
}

/** Spends are only allowed outside reactive tracking contexts (both factories). */
function assertNotReactive(reactiveGuard: (() => boolean) | undefined): void {
	if (reactiveGuard?.()) throw new ReactiveSpendError();
}

/** True when a listings response filled the requested page (more rows may exist). */
function truncatedOf(req: DataRequest, rawBody: unknown): boolean {
	return (
		LISTINGS_ENDPOINTS.has(req.endpoint) &&
		Array.isArray(rawBody) &&
		isTruncated(rawBody.length, limitOf(req))
	);
}

/**
 * The RentCast key test, identical in both modes: it always probes RentCast (sample mode included,
 * since the user is checking a real key). Bypasses cache and cap, but every request that reached
 * RentCast is metered.
 */
async function testKeyWith(
	key: string,
	probeFetch: typeof fetch,
	ledger: LedgerRepo
): Promise<ProbeResult> {
	const result = await testRentCastKey(key, { fetch: probeFetch });
	if (result.status !== null) {
		await ledger.record(
			{
				endpoint: PROBE_REQUEST.endpoint,
				key: canonicalKey(PROBE_REQUEST),
				intent: 'key-test'
			},
			result.status
		);
	}
	return result;
}

export function createDataGateway(deps: LiveGatewayDeps): DataGateway {
	const { client, cache, ledger, clock } = deps;
	const inflight = new Map<string, Promise<GatewayResult>>();
	/** Consecutive 429s per request key; reset by a 200. */
	const rateLimitAttempts = new Map<string, number>();

	let tail: Promise<unknown> = Promise.resolve();
	/** One RentCast call at a time per gateway: spends never interleave. */
	const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
		const run = tail.then(fn, fn);
		tail = run.catch(() => undefined);
		return run;
	};

	const provenanceOf = (row: ApiCacheRow, now: number): Provenance => ({
		source: 'rentcast',
		fetchedAt: row.fetchedAt,
		stale: isStale(row.fetchedAt, row.endpoint as EndpointId, row.status, now)
	});

	const isFresh = (row: ApiCacheRow | undefined, now: number): row is ApiCacheRow =>
		row !== undefined && !isStale(row.fetchedAt, row.endpoint as EndpointId, row.status, now);

	const resultOf = (row: ApiCacheRow, key: string, now: number): GatewayResult => ({
		data: mapPayload(payloadOf(row)),
		provenance: provenanceOf(row, now),
		truncated: row.truncated,
		droppedRows: row.droppedRows,
		requestKey: key
	});

	const negativeErrorOf = (row: ApiCacheRow, key: string, now: number): GatewayError =>
		new GatewayError({
			kind: 'NoResults',
			detail: negativeDetail(row),
			provenance: provenanceOf(row, now),
			requestKey: key
		});

	/** A cached row as the caller sees it: data, or the cached NoResults thrown. */
	const fromCache = (row: ApiCacheRow, key: string, now: number): GatewayResult => {
		if (isNegative(row.status)) throw negativeErrorOf(row, key, now);
		return resultOf(row, key, now);
	};

	async function spend(
		req: DataRequest,
		key: string,
		intent: LedgerIntent,
		grant: OverCapGrant | undefined,
		bypassTtl: boolean
	): Promise<GatewayResult> {
		// Another tab (or an earlier queued job) may have filled the cache while this one waited.
		if (!bypassTtl) {
			const row = await cache.get(key);
			if (isFresh(row, clock())) return fromCache(row, key, clock());
		}

		const id = await ledger.reserve({ endpoint: req.endpoint, key, intent }, grant);
		let raw: { status: number; body: unknown };
		try {
			raw = await client.get(req);
		} catch (e) {
			// Missing key: no request left the browser. Settle as a failure so the row never
			// lingers as pending (which would count toward the cap).
			await ledger.settle(id, 0);
			throw e;
		}
		await ledger.settle(id, raw.status);
		const now = clock();

		if (raw.status === 200) {
			const parsed = parsePayload(req.endpoint, raw.body);
			if (!parsed.ok) {
				// Billed (RentCast answered 200) but never cached: a repeat must not serve garbage.
				throw new GatewayError({ kind: 'SchemaMismatch', issues: parsed.issues, requestKey: key });
			}
			rateLimitAttempts.delete(key);
			const row: ApiCacheRow = {
				key,
				endpoint: req.endpoint,
				status: 200,
				body: storedBody(parsed.payload),
				fetchedAt: now,
				truncated: truncatedOf(req, raw.body),
				droppedRows: parsed.droppedRows
			};
			await cache.put(row);
			return resultOf(row, key, now);
		}

		const classified = classifyResponse(raw.status, raw.body) ?? { kind: 'NetworkError' as const };

		if (isNegative(raw.status)) {
			const row: ApiCacheRow = {
				key,
				endpoint: req.endpoint,
				status: raw.status,
				// Only the classified detail is kept, never the response body.
				body: classified.detail ? { detail: classified.detail } : null,
				fetchedAt: now,
				truncated: false,
				droppedRows: 0
			};
			await cache.put(row);
			throw negativeErrorOf(row, key, now);
		}

		if (raw.status === 429) {
			const attempt = rateLimitAttempts.get(key) ?? 0;
			rateLimitAttempts.set(key, attempt + 1);
			throw new GatewayError({
				kind: 'RateLimited',
				retryInMs: backoffMs(attempt),
				requestKey: key
			});
		}

		throw new GatewayError({ ...classified, requestKey: key });
	}

	async function read(
		req: DataRequest,
		opts: SpendOptions | undefined,
		bypassTtl: boolean
	): Promise<GatewayResult> {
		assertNotReactive(deps.reactiveGuard);
		const key = canonicalKey(req);
		const existing = inflight.get(key);
		if (existing) return existing;

		const run = (async () => {
			if (!bypassTtl) {
				const row = await cache.get(key);
				if (isFresh(row, clock())) return fromCache(row, key, clock());
			}
			const intent: LedgerIntent = bypassTtl ? 'refresh' : (opts?.intent ?? 'user');
			return enqueue(() => spend(req, key, intent, opts?.grant, bypassTtl));
		})().finally(() => inflight.delete(key));
		inflight.set(key, run);
		return run;
	}

	async function estimateKeys(keys: Iterable<string>): Promise<CostEstimate> {
		const now = clock();
		let calls = 0;
		for (const key of new Set(keys)) {
			if (!isFresh(await cache.get(key), now)) calls += 1;
		}
		return { calls, reason: calls === 0 ? 'cached' : 'network' };
	}

	return {
		source: 'rentcast',

		async peek<T = DomainData>(req: DataRequest): Promise<PeekResult<T> | undefined> {
			const key = canonicalKey(req);
			const row = await cache.get(key);
			if (!row) return undefined;
			const now = clock();
			if (isNegative(row.status)) return { kind: 'error', error: negativeErrorOf(row, key, now) };
			return { kind: 'data', result: resultOf(row, key, now) as GatewayResult<T> };
		},

		async peekListingById(id) {
			const found = await cache.findListingById(id);
			if (!found) return undefined;
			const kind = found.row.endpoint === 'sale-listings' ? 'sale' : 'rental';
			return {
				listing: mapListing(found.item, kind),
				provenance: provenanceOf(found.row, clock())
			};
		},

		estimateCost: (req) => estimateKeys([canonicalKey(req)]),

		estimateBatchCost: (reqs) => estimateKeys(reqs.map((r) => canonicalKey(r))),

		get: <T = DomainData>(req: DataRequest, opts?: SpendOptions) =>
			read(req, opts, false) as Promise<GatewayResult<T>>,

		refresh: <T = DomainData>(req: DataRequest, opts?: SpendOptions) =>
			read(req, opts, true) as Promise<GatewayResult<T>>,

		async rentalListingById(id, opts) {
			assertNotReactive(deps.reactiveGuard);
			return (await read(buildListingByIdRequest(id), opts, false)) as GatewayResult<Listing>;
		},

		grantOverCap: (req) => issueGrant(canonicalKey(req)),

		testKey: (key) => testKeyWith(key, deps.probeFetch, ledger),

		usage: () => ledger.usage()
	};
}

/**
 * Sample (demo) mode behind the same port (DATA-01; RESEARCH Pattern 4). The REAL RentCast client,
 * schemas and mappers run over the fixture fetch, so fixtures prove the live parsing path. Every
 * result is badged source 'sample' and costs 0 calls.
 *
 * It never touches the response cache and never reserves ledger rows, so a sample answer can never be served
 * by the live gateway as RentCast data (Pitfall 4) and never counts toward the cap.
 */
export function createSampleGateway(deps: SampleGatewayDeps): DataGateway {
	const { ledger, clock } = deps;
	const client = createRentCastClient({
		fetch: createFixtureFetch(deps.fixtures, clock),
		// The fixture fetch ignores the header; the client only needs a non-empty value.
		getKey: () => 'sample-mode'
	});

	async function run(req: DataRequest): Promise<GatewayResult> {
		const key = canonicalKey(req);
		const raw = await client.get(req);
		const provenance: Provenance = { source: 'sample', fetchedAt: clock(), stale: false };
		if (raw.status === 200) {
			const parsed = parsePayload(req.endpoint, raw.body);
			if (!parsed.ok) {
				throw new GatewayError({ kind: 'SchemaMismatch', issues: parsed.issues, requestKey: key });
			}
			return {
				data: mapPayload(parsed.payload),
				provenance,
				truncated: truncatedOf(req, raw.body),
				droppedRows: parsed.droppedRows,
				requestKey: key
			};
		}
		// 404 'sample/outside-coverage' classifies as NoResults 'outside-sample-coverage'.
		const classified = classifyResponse(raw.status, raw.body) ?? { kind: 'NetworkError' as const };
		throw new GatewayError({ ...classified, provenance, requestKey: key });
	}

	const spend = async (req: DataRequest): Promise<GatewayResult> => {
		assertNotReactive(deps.reactiveGuard);
		return run(req);
	};

	const FREE: CostEstimate = { calls: 0, reason: 'sample' };

	return {
		source: 'sample',

		async peek<T = DomainData>(req: DataRequest): Promise<PeekResult<T> | undefined> {
			try {
				return { kind: 'data', result: (await run(req)) as GatewayResult<T> };
			} catch (e) {
				if (e instanceof GatewayError) return { kind: 'error', error: e };
				throw e;
			}
		},

		async peekListingById(id) {
			try {
				const result = await run(buildListingByIdRequest(id));
				return { listing: result.data as Listing, provenance: result.provenance };
			} catch (e) {
				if (e instanceof GatewayError && e.kind === 'NoResults') return undefined;
				throw e;
			}
		},

		estimateCost: async () => ({ ...FREE }),

		estimateBatchCost: async () => ({ ...FREE }),

		get: <T = DomainData>(req: DataRequest) => spend(req) as Promise<GatewayResult<T>>,

		refresh: <T = DomainData>(req: DataRequest) => spend(req) as Promise<GatewayResult<T>>,

		rentalListingById: (id) =>
			spend(buildListingByIdRequest(id)) as Promise<GatewayResult<Listing>>,

		grantOverCap: (req) => issueGrant(canonicalKey(req)),

		testKey: (key) => testKeyWith(key, deps.probeFetch, ledger),

		usage: () => ledger.usage()
	};
}
