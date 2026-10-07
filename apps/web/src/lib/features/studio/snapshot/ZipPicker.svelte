<script lang="ts" module>
	import { validateZip } from '@tran/core/markets';
	import { buildSnapshotMetrics, snapshotFigureValues } from '@tran/core/studio';
	import { isGatewayError, SAMPLE_METROS, type GatewayError as GatewayErrorType } from '$lib/data';
	import type { Provenance } from '@tran/core/request';
	import type { CostEstimate } from '$lib/features/shared/data/copy/provenance';
	import { formatRelative } from '$lib/features/shared/data/relative-time';
	import type { CostPreview, SnapshotData, ZipData } from './snapshot-data';

	/** One radio row: a watched ZIP (live) or a fixture ZIP (sample). */
	export interface ZipOption {
		zip: string;
		placeName: string | null;
		/** Epoch ms of the saved market data, null when nothing is saved in this browser. */
		savedAt: number | null;
		/** The free cost preview; null until it is known. */
		cost: CostPreview | null;
		sample: boolean;
	}

	/** What onLoaded receives: the 09-14 ZipData plus the ZIP it belongs to. */
	export type LoadedZip = ZipData & { zip: string };

	/** The loaded ZIP's ProvenanceRow input: the gateway's source, fetch time and stale flag. */
	export function loadedProvenance(r: Pick<ZipData, 'source' | 'fetchedAt' | 'stale'>): Provenance {
		return { source: r.source, fetchedAt: Date.parse(r.fetchedAt), stale: r.stale };
	}

	/** The radio value of the last row. */
	export const ANOTHER = 'another';
	export const ZIP_INVALID = 'Enter a 5-digit ZIP code.';
	export const ZIP_REQUIRED = 'Choose a ZIP code.';
	/** The most watched ZIPs the investor portal keeps (Phase 7). */
	export const MAX_ZIP_ROWS = 5;

	const SAMPLE_COST: CostPreview = { calls: 0, cached: false, sample: true };

	/** Sample mode rows: every fixture ZIP with its fictional metro, always 0 calls. */
	export const SAMPLE_ZIP_OPTIONS: readonly ZipOption[] = SAMPLE_METROS.flatMap((m) =>
		m.zipCodes.map((zip) => ({
			zip,
			placeName: m.label,
			savedAt: null,
			cost: SAMPLE_COST,
			sample: true
		}))
	);

	/** CostPreview (09-14) to the CostLabel's estimate shape. */
	export function toEstimate(p: CostPreview | null): CostEstimate | null {
		if (p === null) return null;
		if (p.sample) return { calls: 0, reason: 'sample' };
		if (p.cached) return { calls: 0, reason: 'cached' };
		return { calls: p.calls, reason: 'network' };
	}

	/** "Saved {relative}" or "Not saved in this browser". */
	export function savedText(savedAt: number | null, now: number): string {
		return savedAt === null ? 'Not saved in this browser' : `Saved ${formatRelative(savedAt, now)}`;
	}

	/**
	 * The ZIP the user chose, or the validation message. `choice` is a row's ZIP, ANOTHER or null;
	 * `hasRows` is false when the radio group is omitted and the input shows directly.
	 */
	export function chooseZip(
		choice: string | null,
		typed: string,
		hasRows: boolean
	): { ok: true; zip: string } | { ok: false; message: string } {
		if (hasRows && choice === null) return { ok: false, message: ZIP_REQUIRED };
		if (hasRows && choice !== ANOTHER && choice !== null) return { ok: true, zip: choice };
		const v = validateZip(typed);
		return v.ok ? { ok: true, zip: v.zip } : { ok: false, message: ZIP_INVALID };
	}

	/** "ZIP {zip} loaded. Median rent {value}." (sample: "... from sample data.") */
	export function loadedAnnouncement(r: LoadedZip): string {
		const rent = snapshotFigureValues(buildSnapshotMetrics(r.stats)).medianRent;
		return r.source === 'sample'
			? `ZIP ${r.zip} loaded. Median rent ${rent} from sample data.`
			: `ZIP ${r.zip} loaded. Median rent ${rent}.`;
	}

	export type ZipLoadOutcome =
		| { kind: 'invalid'; message: string }
		| { kind: 'loaded'; result: LoadedZip }
		/** "Not now" on the over-cap prompt: nothing was spent, nothing changes on screen. */
		| { kind: 'dismissed' }
		| { kind: 'error'; error: GatewayErrorType };

	/**
	 * The Load ZIP data click. Invalid input returns before any gateway call; a valid choice spends
	 * through data.loadZipData (cache hit 0 calls, new ZIP 1 call, sample 0), whose requestSpend
	 * applies the ledger cap and the over-cap confirm prompt. Non-gateway errors are rethrown.
	 */
	export async function loadChosenZip(
		data: Pick<SnapshotData, 'loadZipData'>,
		choice: string | null,
		typed: string,
		hasRows: boolean
	): Promise<ZipLoadOutcome> {
		const chosen = chooseZip(choice, typed, hasRows);
		if (!chosen.ok) return { kind: 'invalid', message: chosen.message };
		try {
			const d = await data.loadZipData(chosen.zip);
			return { kind: 'loaded', result: { ...d, zip: chosen.zip } };
		} catch (error) {
			if (!isGatewayError(error)) throw error;
			if (error.kind === 'BudgetCapReached' && error.detail === 'dismissed') {
				return { kind: 'dismissed' };
			}
			return { kind: 'error', error };
		}
	}
</script>

<script lang="ts">
	// 09-UI-SPEC "Step 1: Choose a ZIP code" (STU-04). Rows and costs come from free reads only
	// (watched-ZIP list, cache peek, snapshotZipCost); the single spend is the Load ZIP data click,
	// through loadChosenZip. Sample mode lists the fixture ZIPs and never reads the cache.
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { MarketStats } from '@tran/core/listings';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import { getDataRuntime } from '$lib/data';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import ProvenanceRow from '$lib/features/shared/data/ProvenanceRow.svelte';
	import { Button, Input, Label, announce } from '$lib/features/shared/data/platform-ui';
	import {
		createMarketsPort,
		marketStatsRequest,
		type PortRuntime
	} from '$lib/features/shared/markets/markets-port';
	import { listWatchedZips } from '$lib/features/shared/markets/watchedZipsRepo';
	import SnapshotKeyFigures from './SnapshotKeyFigures.svelte';
	import { createSnapshotData } from './snapshot-data';

	interface Props {
		onLoaded: (r: LoadedZip) => void;
		/** "Choose a different ZIP": the loaded data is no longer the report's (owners reset). */
		onCleared?: () => void;
		sampleMode: boolean;
		/** The snapshot data path; defaults to the app's data runtime (Svelte context). */
		data?: SnapshotData;
		/** Live rows read ahead of time; when absent the watched ZIPs are read after mount. */
		options?: readonly ZipOption[];
		/** Clock for "Saved {relative}" and the provenance chip. */
		now?: number;
		/** true while Load ZIP data is in flight (the owning step sets aria-busy from it too). */
		busy?: boolean;
		/** The ZIP to preselect (the builder's autosaved choice). Read once; nothing is loaded. */
		initialZip?: string | null;
	}

	let {
		onLoaded,
		onCleared,
		sampleMode,
		data,
		options,
		now,
		busy = $bindable(false),
		initialZip = null
	}: Props = $props();

	// Injected once at creation: the data path and the runtime never change for this component.
	const runtime: PortRuntime | null = untrack(() => (data ? null : getDataRuntime()));
	const snap: SnapshotData = untrack(() => data ?? createSnapshotData(runtime as PortRuntime));

	const uid = $props.id();
	const inputId = `${uid}-zip`;
	const helperId = `${uid}-helper`;
	const errorId = `${uid}-error`;
	const loadedHeadingId = `${uid}-loaded`;

	// The autosaved ZIP: a matching sample row, else the typed input (a watched row once the list
	// arrives). Preselecting is free; only Load ZIP data spends.
	const startZip: string | null = untrack(() =>
		initialZip && validateZip(initialZip).ok ? initialZip : null
	);
	const startIsSampleRow = untrack(
		() => sampleMode && startZip !== null && SAMPLE_ZIP_OPTIONS.some((o) => o.zip === startZip)
	);

	let watchedRows = $state<ZipOption[]>([]);
	let choice = $state<string | null>(
		startIsSampleRow ? startZip : untrack(() => (startZip && !sampleMode ? ANOTHER : null))
	);
	let typed = $state(untrack(() => (startZip && !sampleMode ? startZip : '')));
	let typedCost = $state<CostPreview | null>(null);
	let fieldError = $state<string | null>(null);
	let gatewayError = $state<GatewayErrorType | null>(null);
	let loaded = $state<LoadedZip | null>(null);
	let focusLoaded = $state(false);
	let focusPicker = $state(false);
	let headingEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let loadButton = $state<HTMLButtonElement | null>(null);
	let radiosEl = $state<HTMLElement | null>(null);
	let clock = $state(Date.now());

	const rows = $derived<readonly ZipOption[]>(
		sampleMode ? SAMPLE_ZIP_OPTIONS : (options ?? watchedRows)
	);
	const hasRows = $derived(rows.length > 0);
	const showInput = $derived(!sampleMode && (!hasRows || choice === ANOTHER));
	const buttonCost = $derived.by<CostPreview | null>(() => {
		if (sampleMode) return SAMPLE_COST;
		if (showInput) return typedCost;
		return rows.find((r) => r.zip === choice)?.cost ?? null;
	});
	const nowMs = $derived(now ?? clock);

	/** Free reads: the watched list, each ZIP's cost preview and its cache entry. */
	async function readWatchedRows(): Promise<ZipOption[]> {
		const watched = (await listWatchedZips()).slice(0, MAX_ZIP_ROWS);
		const markets = runtime ? createMarketsPort(runtime) : null;
		return Promise.all(
			watched.map(async ({ zip }) => {
				const [cost, peeked] = await Promise.all([
					snap.snapshotZipCost(zip).catch(() => null),
					markets ? markets.peek(zip).catch(() => undefined) : Promise.resolve(undefined)
				]);
				return {
					zip,
					placeName: null,
					savedAt: peeked?.provenance.fetchedAt ?? null,
					cost,
					sample: false
				};
			})
		);
	}

	onMount(() => {
		clock = Date.now();
		// A preselected typed ZIP shows its free cost preview like a typed one.
		if (typed !== '') onInput();
	});

	// Re-reads the free rows when the mode resolves to live (a key added mid-session). Reads only:
	// nothing here can spend.
	$effect(() => {
		if (sampleMode || options !== undefined) return;
		let stale = false;
		void readWatchedRows()
			.then((r) => {
				if (stale) return;
				watchedRows = r;
				if (
					untrack(() => choice === ANOTHER && typed === startZip) &&
					r.some((o) => o.zip === startZip)
				) {
					choice = startZip;
				}
			})
			.catch(() => {
				if (!stale) watchedRows = [];
			});
		return () => {
			stale = true;
		};
	});

	// Focus settles once the loaded heading (or the picker) is in the DOM.
	$effect(() => {
		if (focusLoaded && headingEl) {
			headingEl.focus();
			focusLoaded = false;
		}
	});
	$effect(() => {
		if (focusPicker && loadButton) {
			loadButton.focus();
			focusPicker = false;
		}
	});

	/** Free: the typed ZIP's cost preview, read from the input handler once it is valid. */
	function onInput(): void {
		fieldError = null;
		const v = validateZip(typed);
		if (!v.ok) {
			typedCost = null;
			return;
		}
		const zip = v.zip;
		void snap
			.snapshotZipCost(zip)
			.then((c) => {
				if (validateZip(typed).ok && typed.trim() === zip) typedCost = c;
			})
			.catch(() => {
				typedCost = null;
			});
	}

	function onChoose(value: string): void {
		choice = value;
		fieldError = null;
	}

	function focusInvalid(message: string): void {
		fieldError = message;
		if (message === ZIP_INVALID && inputEl) inputEl.focus();
		else radiosEl?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
	}

	function settle(result: LoadedZip): void {
		loaded = result;
		announce(loadedAnnouncement(result));
		onLoaded(result);
		focusLoaded = true;
	}

	async function load(): Promise<void> {
		if (busy) return;
		busy = true;
		gatewayError = null;
		try {
			const outcome = await loadChosenZip(snap, choice, typed, hasRows || sampleMode);
			if (outcome.kind === 'invalid') focusInvalid(outcome.message);
			else if (outcome.kind === 'error') gatewayError = outcome.error;
			else if (outcome.kind === 'loaded') settle(outcome.result);
		} finally {
			busy = false;
		}
	}

	/** Refresh (1 call, bypasses the TTL): live data only, from the provenance row's button. */
	async function refresh(): Promise<void> {
		const current = loaded;
		if (!runtime || !current) return;
		try {
			const r = await runtime.requestSpend<MarketStats>(marketStatsRequest(current.zip), 'refresh');
			settle({
				zip: current.zip,
				stats: r.data,
				fetchedAt: new Date(r.provenance.fetchedAt).toISOString(),
				stale: r.provenance.stale,
				source: r.provenance.source,
				placeName: current.placeName
			});
		} catch (error) {
			if (!isGatewayError(error)) throw error;
			if (error.kind === 'BudgetCapReached' && error.detail === 'dismissed') return;
			loaded = null;
			gatewayError = error;
		}
	}

	function chooseDifferent(): void {
		loaded = null;
		gatewayError = null;
		focusPicker = true;
		onCleared?.();
	}

	const loadedMetrics = $derived(loaded ? buildSnapshotMetrics(loaded.stats) : null);
	const radioRow =
		'relative flex min-h-11 cursor-pointer touch-manipulation items-start gap-2 rounded-md py-2 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring';
</script>

<div class="flex flex-col gap-4" aria-busy={busy ? 'true' : undefined} data-zip-picker>
	{#if loaded && loadedMetrics}
		<div class="flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<h3
					id={loadedHeadingId}
					bind:this={headingEl}
					tabindex="-1"
					class="text-base leading-[1.6] font-semibold text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					ZIP {loaded.zip}
				</h3>
				{#if loaded.placeName}
					<p class="text-base leading-[1.6] text-muted-foreground">{loaded.placeName}</p>
				{/if}
			</div>
			<ProvenanceRow
				provenance={loadedProvenance(loaded)}
				onRefresh={runtime && loaded.source === 'rentcast' ? refresh : undefined}
				{now}
			/>
			<SnapshotKeyFigures metrics={loadedMetrics} />
			<div>
				<Button variant="ghost" onclick={chooseDifferent}>Choose a different ZIP</Button>
			</div>
		</div>
	{:else}
		{#if hasRows || sampleMode}
			<fieldset
				bind:this={radiosEl}
				class="flex min-w-0 flex-col gap-2"
				aria-describedby={fieldError && !showInput ? errorId : undefined}
			>
				<legend class="text-base leading-[1.6] font-semibold text-foreground">ZIP code</legend>
				{#each rows as row (row.zip)}
					<label class={radioRow}>
						<input
							type="radio"
							name="{uid}-zip-choice"
							value={row.zip}
							checked={choice === row.zip}
							onchange={() => onChoose(row.zip)}
							class="mt-1 size-5 shrink-0 accent-primary"
						/>
						<span class="flex min-w-0 flex-col">
							<span class="text-base leading-[1.6] font-semibold text-foreground tabular-nums"
								>ZIP {row.zip}</span
							>
							{#if row.placeName}
								<span class="text-base leading-[1.6] text-muted-foreground">{row.placeName}</span>
							{/if}
							<span class="flex flex-wrap items-center gap-2 text-label text-muted-foreground">
								{#if row.sample}
									<SampleChip />
								{:else}
									<span class="tabular-nums">{savedText(row.savedAt, nowMs)}</span>
								{/if}
								<span class="text-foreground"><CostLabel estimate={toEstimate(row.cost)} /></span>
							</span>
						</span>
					</label>
				{/each}
				{#if sampleMode}
					<p class="text-label text-muted-foreground">
						Sample data covers a few made-up ZIP codes. Add a RentCast key in Settings to use any
						ZIP code.
						<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus a same-page fragment -->
						<a
							href={`${resolve('/settings/')}#api-keys`}
							class="inline-flex min-h-11 items-center text-foreground underline underline-offset-2"
							>Add a RentCast key</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</p>
				{:else}
					<label class={radioRow}>
						<input
							type="radio"
							name="{uid}-zip-choice"
							value={ANOTHER}
							checked={choice === ANOTHER}
							onchange={() => onChoose(ANOTHER)}
							class="mt-1 size-5 shrink-0 accent-primary"
						/>
						<span class="text-base leading-[1.6] font-semibold text-foreground"
							>Another ZIP code</span
						>
					</label>
				{/if}
			</fieldset>
		{/if}

		{#if showInput}
			<div class="flex flex-col gap-2">
				<Label for={inputId} class="text-base leading-[1.6] font-semibold text-foreground"
					>ZIP code to load</Label
				>
				<Input
					id={inputId}
					bind:ref={inputEl}
					bind:value={typed}
					oninput={onInput}
					inputmode="numeric"
					maxlength={5}
					autocomplete="postal-code"
					aria-invalid={fieldError ? 'true' : undefined}
					aria-describedby={[!hasRows ? helperId : '', fieldError ? errorId : '']
						.filter(Boolean)
						.join(' ') || undefined}
					class="h-12 w-full text-base tabular-nums sm:w-36"
				/>
				{#if !hasRows}
					<p id={helperId} class="text-label text-muted-foreground">
						ZIP codes you watch in the investor portal show up here, and loading them again costs
						nothing while their data is saved.
					</p>
				{/if}
			</div>
		{/if}

		{#if fieldError}
			<p id={errorId} class="flex items-center gap-1 text-label text-destructive">
				<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{fieldError}
			</p>
		{/if}

		<div>
			<Button bind:ref={loadButton} class="h-12 w-full sm:w-auto" disabled={busy} onclick={load}>
				{#if busy}
					<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
					Loading…
				{:else}
					Load ZIP data <CostLabel estimate={toEstimate(buttonCost)} />
				{/if}
			</Button>
		</div>

		{#if gatewayError}
			<GatewayError
				error={gatewayError}
				focusOnMount={true}
				onTryAgain={load}
				onContinuePastCap={() => void load()}
			/>
		{/if}
	{/if}
</div>
