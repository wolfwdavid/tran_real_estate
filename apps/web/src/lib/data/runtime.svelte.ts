// The app-wide data runtime (DATA-01..04). One instance per app, created in the (app) layout and
// shared through Svelte context. It owns:
//   - mode: sample or live, resolved from the RentCast key state + the user's source preference,
//     re-resolved on every key change, preference change and cross-tab message;
//   - the gateway for that mode (rebuilt on every mode re-resolution; fixtures loaded once, only
//     in sample mode);
//   - usage: the ledger snapshot plus meter state, kept current by a Dexie liveQuery;
//   - the over-cap prompt: a user spend that hits the cap parks and exposes `capPrompt` instead of
//     failing. Confirming spends exactly ONE call with a fresh single-use grant; nothing is
//     remembered, so the next over-cap call prompts again (CONTEXT "Confirmation is per call");
//   - cross-tab sync over BroadcastChannel('tran-data') for cap and source changes.
//
// Views read with createPeekStore/gateway.peek (0 calls). Only click handlers call requestSpend.
import { getContext, setContext } from 'svelte';
import { liveQuery } from 'dexie';
import { meterState, type MeterState } from '@tran/core/budget';
import { GatewayError, isGatewayError, type DataRequest } from '@tran/core/request';
import { createDataChannel, type ChannelLike, type DataMessage } from './broadcast';
import { createCacheRepo } from './cache-repo';
import type { FixtureSet } from './fixtures/fixture-fetch';
import { loadFixtureSet } from './fixtures/load';
import {
	createDataGateway,
	createSampleGateway,
	ReactiveSpendError,
	type DataGateway,
	type GatewayResult
} from './gateway';
import { createLedgerRepo, type UsageSnapshot } from './ledger-repo';
import { resolveMode, type ResolvedMode } from './mode';
import {
	getDataDb,
	getRentCastKey,
	getRentCastKeyState,
	onRentCastKeyChange,
	type DataDb,
	type RentCastKeyState,
	type RentCastKeyTestOutcome
} from './platform';
import { createPrefsRepo } from './prefs-repo';
import { inReactiveContext } from './reactive-guard.svelte';
import { browserFetch, createRentCastClient } from './rentcast/client';
import type { DataSourcePref } from './tables';

export type { ChannelLike, DataMessage } from './broadcast';

/** The RentCast key as the runtime sees it (platform.ts in the app, a fake in tests). */
export interface KeyPort {
	get(): string | null;
	state(): RentCastKeyState;
	onChange(cb: () => void): () => void;
}

export interface CapPrompt {
	used: number;
	cap: number;
	requestKey: string;
}

export interface KeyTestRecord {
	outcome: RentCastKeyTestOutcome | 'bad-format';
	formatError?: 'empty' | 'whitespace' | 'charset' | 'length';
	at: number;
}

export type RuntimeUsage = UsageSnapshot & { state: MeterState };

export interface DataRuntime {
	/** null until start() resolves. */
	readonly mode: ResolvedMode | null;
	readonly usage: RuntimeUsage | null;
	readonly gateway: DataGateway | null;
	readonly capPrompt: CapPrompt | null;
	/** seq increments on every message received from another tab. */
	readonly lastRemoteChange: { type: DataMessage['type']; seq: number } | null;
	/** Call from onMount; resolves to a cleanup function. */
	start(): Promise<() => void>;
	/** The only spend path for click handlers. Over the cap it waits on the confirm prompt. */
	requestSpend<T>(req: DataRequest, kind?: 'get' | 'refresh'): Promise<GatewayResult<T>>;
	confirmCapPrompt(): Promise<void>;
	cancelCapPrompt(): void;
	setSourcePreference(p: DataSourcePref): Promise<void>;
	saveCap(cap: number): Promise<void>;
	testKey(): Promise<KeyTestRecord>;
}

export interface DataRuntimeDeps {
	db?: DataDb;
	clock?: () => number;
	fetch?: typeof fetch;
	keys?: KeyPort;
	/** null disables cross-tab sync. Omitted: BroadcastChannel('tran-data') when available. */
	channel?: ChannelLike | null;
	reactiveGuard?: () => boolean;
	loadFixtures?: () => Promise<FixtureSet>;
}

interface ParkedSpend {
	req: DataRequest;
	kind: 'get' | 'refresh';
	prompt: CapPrompt;
	resolve: (r: GatewayResult) => void;
	reject: (e: unknown) => void;
}

const isDataMessage = (m: unknown): m is DataMessage =>
	typeof m === 'object' &&
	m !== null &&
	((m as DataMessage).type === 'cap-changed' || (m as DataMessage).type === 'source-changed');

class Runtime implements DataRuntime {
	#mode = $state<ResolvedMode | null>(null);
	#usage = $state<RuntimeUsage | null>(null);
	#gateway = $state<DataGateway | null>(null);
	#capPrompt = $state<CapPrompt | null>(null);
	#lastRemoteChange = $state<{ type: DataMessage['type']; seq: number } | null>(null);

	readonly #db: DataDb;
	readonly #clock: () => number;
	readonly #fetch: typeof fetch;
	readonly #keys: KeyPort;
	readonly #channelOverride: ChannelLike | null | undefined;
	readonly #reactiveGuard: () => boolean;
	readonly #loadFixtures: () => Promise<FixtureSet>;
	readonly #ledger;
	readonly #cache;
	readonly #prefs;

	#fixtures: Promise<FixtureSet> | null = null;
	/** The latest rebuild; spends wait for it so they never hit a gateway that is being replaced. */
	#ready: Promise<void> | null = null;
	#rebuildGen = 0;
	#usageGen = 0;
	#remoteSeq = 0;
	#parked: ParkedSpend | null = null;
	#channel: ChannelLike | null = null;

	constructor(deps: DataRuntimeDeps) {
		this.#db = deps.db ?? getDataDb();
		// The one Date.now in lib/data: the production default clock. Everything else is injected.
		this.#clock = deps.clock ?? (() => Date.now());
		this.#fetch = deps.fetch ?? browserFetch;
		this.#keys = deps.keys ?? {
			get: getRentCastKey,
			state: getRentCastKeyState,
			onChange: onRentCastKeyChange
		};
		this.#channelOverride = 'channel' in deps ? deps.channel : undefined;
		this.#reactiveGuard = deps.reactiveGuard ?? inReactiveContext;
		this.#loadFixtures = deps.loadFixtures ?? loadFixtureSet;
		this.#ledger = createLedgerRepo(this.#db, this.#clock);
		this.#cache = createCacheRepo(this.#db);
		this.#prefs = createPrefsRepo(this.#db, this.#clock);
	}

	get mode() {
		return this.#mode;
	}
	get usage() {
		return this.#usage;
	}
	get gateway() {
		return this.#gateway;
	}
	get capPrompt() {
		return this.#capPrompt;
	}
	get lastRemoteChange() {
		return this.#lastRemoteChange;
	}

	// -------------------------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------------------------

	async start(): Promise<() => void> {
		const offKeys = this.#keys.onChange(() => {
			// A failed rebuild keeps the previous gateway; the next spend retries it.
			this.#rebuild().catch(() => undefined);
		});

		const channel =
			this.#channelOverride === undefined ? createDataChannel() : this.#channelOverride;
		this.#channel = channel;
		channel?.addEventListener('message', (e) => {
			if (isDataMessage(e.data)) this.#onRemote(e.data.type).catch(() => undefined);
		});

		const usageSub = liveQuery(() => this.#ledger.usage()).subscribe({
			next: (u) => this.#setUsage(u, ++this.#usageGen),
			error: () => {
				// Storage unavailable: keep the last snapshot; spends surface their own errors.
			}
		});

		let stopped = false;
		const stop = () => {
			if (stopped) return;
			stopped = true;
			offKeys();
			usageSub.unsubscribe();
			channel?.close();
			if (this.#channel === channel) this.#channel = null;
			this.cancelCapPrompt();
		};

		try {
			await this.#rebuild();
			await this.#refreshUsage();
		} catch (e) {
			stop();
			throw e;
		}
		return stop;
	}

	/** Re-resolves the mode and builds the matching gateway. The latest call wins. */
	#rebuild(): Promise<void> {
		const gen = ++this.#rebuildGen;
		const run = (async () => {
			const preference = await this.#prefs.readSource();
			const mode = resolveMode({ keyState: this.#keys.state(), preference });
			const gateway = await this.#build(mode);
			if (gen !== this.#rebuildGen) return; // a newer rebuild owns the state
			this.#mode = mode;
			this.#gateway = gateway;
		})();
		this.#ready = run;
		return run;
	}

	async #build(mode: ResolvedMode): Promise<DataGateway> {
		const common = {
			ledger: this.#ledger,
			clock: this.#clock,
			probeFetch: this.#fetch,
			reactiveGuard: this.#reactiveGuard
		};
		if (mode.source === 'rentcast') {
			return createDataGateway({
				...common,
				client: createRentCastClient({ fetch: this.#fetch, getKey: this.#keys.get }),
				cache: this.#cache
			});
		}
		this.#fixtures ??= this.#loadFixtures().catch((e: unknown) => {
			this.#fixtures = null; // allow a retry on the next rebuild
			throw e;
		});
		return createSampleGateway({ ...common, fixtures: await this.#fixtures });
	}

	/** The current gateway, building one first if start() has not run yet. */
	async #currentGateway(): Promise<DataGateway> {
		let ready = this.#ready ?? this.#rebuild();
		// A rebuild may start while we wait (key change, remote message): wait for the newest one.
		for (;;) {
			await ready;
			if (ready === this.#ready || !this.#ready) break;
			ready = this.#ready;
		}
		if (!this.#gateway) throw new Error('data runtime has no gateway');
		return this.#gateway;
	}

	async #onRemote(type: DataMessage['type']): Promise<void> {
		const seq = ++this.#remoteSeq;
		try {
			if (type === 'source-changed') await this.#rebuild();
			else await this.#refreshUsage();
		} finally {
			// Never step backwards if two messages finish out of order.
			if (!this.#lastRemoteChange || this.#lastRemoteChange.seq < seq) {
				this.#lastRemoteChange = { type, seq };
			}
		}
	}

	#post(m: DataMessage): void {
		try {
			this.#channel?.postMessage(m);
		} catch {
			// A closed channel must not fail a save that already succeeded.
		}
	}

	// -------------------------------------------------------------------------------------------
	// Usage
	// -------------------------------------------------------------------------------------------

	#setUsage(u: UsageSnapshot, gen: number): void {
		if (gen < this.#usageGen) return; // an older read finished after a newer one
		this.#usage = { ...u, state: meterState(u.countedTowardCap, u.cap) };
	}

	async #refreshUsage(): Promise<void> {
		const gen = ++this.#usageGen;
		this.#setUsage(await this.#ledger.usage(), gen);
	}

	// -------------------------------------------------------------------------------------------
	// Spending and the over-cap prompt
	// -------------------------------------------------------------------------------------------

	requestSpend<T>(req: DataRequest, kind: 'get' | 'refresh' = 'get'): Promise<GatewayResult<T>> {
		// Checked synchronously, before any await, so the caller's tracking context is still visible.
		if (this.#reactiveGuard()) return Promise.reject(new ReactiveSpendError());
		return this.#spend(req, kind) as Promise<GatewayResult<T>>;
	}

	async #spend(req: DataRequest, kind: 'get' | 'refresh'): Promise<GatewayResult> {
		const gateway = await this.#currentGateway();
		let result: GatewayResult;
		try {
			result = await gateway[kind](req);
		} catch (e) {
			// A failed call can still be billed (e.g. 401 settles a ledger row).
			void this.#refreshUsage().catch(() => undefined);
			if (!isGatewayError(e) || e.kind !== 'BudgetCapReached' || e.detail === 'dismissed') throw e;
			// One prompt at a time: a second over-cap request while one is open fails as-is.
			if (this.#parked) throw e;
			return new Promise<GatewayResult>((resolve, reject) => {
				const prompt: CapPrompt = {
					used: e.used ?? 0,
					cap: e.cap ?? 0,
					requestKey: e.requestKey ?? ''
				};
				this.#parked = { req, kind, prompt, resolve, reject };
				this.#capPrompt = prompt;
			});
		}
		// Usage is current when the caller resumes (liveQuery also catches up, but asynchronously).
		await this.#refreshUsage().catch(() => undefined);
		return result;
	}

	#takeParked(): ParkedSpend | null {
		const parked = this.#parked;
		this.#parked = null;
		this.#capPrompt = null;
		return parked;
	}

	async confirmCapPrompt(): Promise<void> {
		const parked = this.#takeParked();
		if (!parked) return;
		try {
			const gateway = await this.#currentGateway();
			// A fresh single-use grant per confirmation, bound to this one request.
			const result = await gateway[parked.kind](parked.req, {
				grant: gateway.grantOverCap(parked.req)
			});
			parked.resolve(result);
		} catch (e) {
			// The error belongs to the requestSpend caller; the dialog just closes.
			parked.reject(e);
		} finally {
			await this.#refreshUsage().catch(() => undefined);
		}
	}

	cancelCapPrompt(): void {
		const parked = this.#takeParked();
		if (!parked) return;
		parked.reject(
			new GatewayError({
				kind: 'BudgetCapReached',
				detail: 'dismissed',
				used: parked.prompt.used,
				cap: parked.prompt.cap,
				requestKey: parked.prompt.requestKey
			})
		);
	}

	// -------------------------------------------------------------------------------------------
	// Settings actions
	// -------------------------------------------------------------------------------------------

	async setSourcePreference(p: DataSourcePref): Promise<void> {
		await this.#prefs.writeSource(p);
		await this.#rebuild();
		this.#post({ type: 'source-changed' });
	}

	async saveCap(cap: number): Promise<void> {
		await this.#ledger.writeCap(cap);
		await this.#refreshUsage();
		this.#post({ type: 'cap-changed' });
	}

	async testKey(): Promise<KeyTestRecord> {
		const gateway = await this.#currentGateway();
		const result = await gateway.testKey(this.#keys.get() ?? '');
		const at = this.#clock();
		await this.#refreshUsage().catch(() => undefined);
		return result.outcome === 'bad-format'
			? { outcome: 'bad-format', formatError: result.formatError, at }
			: { outcome: result.outcome, at };
	}
}

export function createDataRuntime(deps: DataRuntimeDeps = {}): DataRuntime {
	return new Runtime(deps);
}

const RUNTIME_KEY = Symbol('tran-data-runtime');

/** Call once in the (app) layout's script, before children render. */
export function setDataRuntime(rt: DataRuntime): void {
	setContext(RUNTIME_KEY, rt);
}

/** Throws outside the (app) layout tree. */
export function getDataRuntime(): DataRuntime {
	const rt = getContext<DataRuntime | undefined>(RUNTIME_KEY);
	if (!rt) throw new Error('getDataRuntime() used outside the app layout (no data runtime set)');
	return rt;
}
