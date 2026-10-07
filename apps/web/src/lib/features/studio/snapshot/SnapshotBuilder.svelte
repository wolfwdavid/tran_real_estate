<script lang="ts" module>
	import type { CheckGroupCopy } from '$lib/ai/ui/post-check';

	export const FEATURE = 'studio-snapshot';
	export const PROMPT_ID = 'studio/snapshot.v1';
	export const LEAD =
		'Build a branded market report for a ZIP code from RentCast market data, then print it or save it as a PDF. Every number in the report is calculated by Tran from that data.';
	export const REPORT_LABEL =
		'Market information only. Not a comparative market analysis or a professional valuation of any property.';
	export const STEP_EMPTY = "Load a ZIP code's data first.";
	export const NOTES_USES =
		"The AI writes the words. Every number comes from this report, and Tran flags any number it didn't calculate.";
	export const NOTES_OFF = 'Market notes are turned off in step 2.';
	export const SAVED_ANNOUNCEMENT = 'Snapshot saved. Opening the print view.';
	export const SAVE_FAILED_TITLE = "Your snapshot wasn't saved";
	export const SAVE_FAILED_BODY =
		'Nothing was spent and your choices are still here. Try again. If it keeps failing, check Storage in Settings.';

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	/** Presentational copy for the notes panel's two studio checks (no check logic). */
	export const SNAPSHOT_CHECK_GROUPS: CheckGroupCopy[] = [
		{
			checker: 'numbers',
			label: 'Number check',
			passedTitle: 'Number check passed',
			passedNote: 'Every number in these notes is a figure from this report.',
			findingsTitle: (b, w) => `Number check: ${b + w} to fix`,
			allowRemovePhrase: false,
			doneSentence: (b, w) =>
				b + w === 0
					? 'Every number matches this report.'
					: `${plural(b + w, 'number', 'numbers')} to fix.`
		},
		{
			checker: 'number-words',
			label: 'Numbers written as words',
			passedTitle: 'Numbers are written as digits',
			findingsTitle: (b, w) => `Numbers written as words: ${b + w} to review`,
			allowRemovePhrase: false,
			doneSentence: (b, w) =>
				b + w === 0 ? '' : `${plural(b + w, 'number word', 'number words')} to review.`
		}
	];
</script>

<script lang="ts">
	// 09-UI-SPEC "Market Snapshot builder" (STU-04): lead, the report label, four numbered steps and
	// Your snapshots. Step 1 (ZipPicker) and the step 2 listings summary are the only spends, from
	// their click handlers. Step 3 drafts the notes with the Phase 5 GenerationPanel over the report
	// figures, with the number check gating them. Step 4 saves one frozen record (0 calls) and
	// opens the print view; it is gated by saveGateReason. The choices autosave (never the data).
	// Browser only: the route mounts this after hydration (Dexie, the gateway and the AI runner).
	import { onMount, tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Info from '@lucide/svelte/icons/info';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Printer from '@lucide/svelte/icons/printer';
	import {
		EMPTY_PROFILE_INPUT,
		type AgentProfile,
		type ProfileInput
	} from '@tran/core/agent/types';
	import type { Finding } from '@tran/core/fair-housing';
	import { longDate } from '@tran/core/format';
	import { buildSnapshotMetrics, missingFor, snapshotAllowedNumbers } from '@tran/core/studio';
	import { getDataRuntime } from '$lib/data';
	import type { AiArtifact, ArtifactRepo } from '$lib/ai/storage/artifacts';
	import DraftHistory from '$lib/ai/ui/DraftHistory.svelte';
	import GenerationPanel from '$lib/ai/ui/GenerationPanel.svelte';
	import { runChecks } from '$lib/ai/ui/panel-controller';
	import { announce, Button } from '$lib/features/shared/data/platform-ui';
	import {
		loadAgentProfile,
		SAMPLE_AGENT_PROFILE,
		toDisclosureProfile
	} from '$lib/features/shared/agent-profile';
	import SectionError from '$lib/features/shared/settings/SectionError.svelte';
	import { createStudioAutosave } from '$lib/storage/studio/autosave.svelte';
	import type { SnapshotNarrative, SnapshotRecord } from '$lib/storage/studio/types';
	import { numberPostCheck, numberWordsPostCheck } from '../post-checks';
	import { buildSnapshotRecord } from './build-record';
	import {
		choicesData,
		defaultInclude,
		missingLabels,
		notesGateFields,
		notesSummary,
		parseChoices,
		saveGateReason,
		spendText,
		type Spend
	} from './save-gate';
	import {
		createSnapshotData,
		type CostPreview,
		type ListingsKind,
		type SnapshotData
	} from './snapshot-data';
	import SnapshotList from './SnapshotList.svelte';
	import SnapshotSectionToggles, {
		DATA_SECTION_KEYS,
		type LoadedListings,
		type SnapshotIncludeValue
	} from './SnapshotSectionToggles.svelte';
	import ZipPicker, { type LoadedZip } from './ZipPicker.svelte';

	const runtime = getDataRuntime();
	const base = createSnapshotData(runtime);
	const autosave = createStudioAutosave('snapshot');

	// The listings summary goes through this wrapper so step 4 knows what the load spent: the free
	// cost preview is read just before the (single) spend.
	let listingsSpend = $state<Spend | null>(null);
	const toggleData: SnapshotData = {
		snapshotZipCost: base.snapshotZipCost,
		loadZipData: base.loadZipData,
		listingsSummaryCost: base.listingsSummaryCost,
		async loadListingsSummary(zip: string, kind: ListingsKind) {
			const cost: CostPreview | null = await base.listingsSummaryCost(zip, kind).catch(() => null);
			const r = await base.loadListingsSummary(zip, kind);
			listingsSpend = cost?.sample ? 'sample' : cost?.cached ? 'cached' : 'network';
			return r;
		}
	};

	const uid = $props.id();
	const step = (n: number) => `${uid}-step-${n}`;
	const reasonId = `${uid}-save-reason`;

	let restored = $state(false);
	let initialZip = $state<string | null>(null);
	let include = $state.raw<SnapshotIncludeValue>(defaultInclude());
	let loaded = $state.raw<LoadedZip | null>(null);
	let zipSpend = $state<Spend | null>(null);
	let listings = $state.raw<LoadedListings | null>(null);
	let zipBusy = $state(false);
	let loadStartedAt: number | null = null;
	let profile = $state.raw<AgentProfile | null>(null);
	let records = $state.raw<SnapshotRecord[] | null>(null);
	let repo = $state<ArtifactRepo | null>(null);
	let refreshKey = $state(0);
	let panel = $state<ReturnType<typeof GenerationPanel> | null>(null);
	let saving = $state(false);
	let saveFailed = $state(false);
	let reasonEl = $state<HTMLElement | null>(null);
	/** A finding the panel's 300 ms recheck has not shown yet, found by Save's own recheck. */
	let urgentReason = $state<string | null>(null);

	// Read-only outputs of the notes panel (Phase 5 / 07-04 bindables).
	let canExit = $state(false);
	let blocked = $state(false);
	let findings = $state.raw<Finding[]>([]);
	let artifactId = $state<string | null>(null);
	let draftText = $state('');

	const modeReady = $derived(runtime.mode !== null);
	const sampleMode = $derived(runtime.mode?.source !== 'rentcast');
	const metrics = $derived(loaded ? buildSnapshotMetrics(loaded.stats) : null);
	const notesOn = $derived(include.sections.includes('marketNotes'));
	const dataSections = $derived(include.sections.filter((k) => DATA_SECTION_KEYS.includes(k)));
	const listingsIncluded = $derived(
		include.listingsKind !== null &&
			listings !== null &&
			listings.sample.kind === include.listingsKind
			? listings
			: null
	);
	const live = $derived(loaded?.source === 'rentcast');
	const profileMissing = $derived(
		missingLabels(missingFor(toDisclosureProfile(profile ?? EMPTY_PROFILE_INPUT), 'print'))
	);
	// Sample data with an incomplete profile: the sample agent goes into the record (marked sample).
	const recordProfile = $derived<ProfileInput>(
		!live && profileMissing.length > 0 ? SAMPLE_AGENT_PROFILE : (profile ?? EMPTY_PROFILE_INPUT)
	);
	const notesInputs = $derived(
		loaded && metrics
			? { metrics, sample: listingsIncluded?.sample ?? null, asOf: loaded.fetchedAt }
			: undefined
	);
	const postChecks = $derived(
		notesInputs
			? [
					numberPostCheck(
						'snapshot',
						snapshotAllowedNumbers(notesInputs.metrics, notesInputs.sample, notesInputs.asOf)
					),
					numberWordsPostCheck()
				]
			: []
	);
	// The panel restarts when the report figures change, so a draft never outlives its numbers.
	const factsKey = $derived(
		loaded
			? `${loaded.zip}|${loaded.fetchedAt}|${listingsIncluded ? `${listingsIncluded.sample.kind}|${listingsIncluded.fetchedAt}` : ''}`
			: ''
	);
	const notes = $derived(notesGateFields({ draftText, canExit, findings }));
	const gateReason = $derived(
		saveGateReason({
			hasData: loaded !== null,
			dataSections: dataSections.length,
			notesOn,
			...notes,
			profileMissing,
			live
		})
	);
	const shownReason = $derived(gateReason ?? urgentReason);
	const asOfText = $derived(loaded ? longDate(Date.parse(loaded.fetchedAt)) : '');

	onMount(() => {
		let alive = true;
		void autosave
			.load()
			.catch(() => null)
			.then((raw) => {
				if (!alive) return;
				const c = parseChoices(raw);
				if (c) {
					include = c.include;
					initialZip = c.zip;
				}
				restored = true;
			});
		void loadAgentProfile()
			.catch(() => null)
			.then((p) => {
				if (alive) profile = p;
			});
		void import('$lib/storage/studio/snapshots-repo')
			.then((m) => m.listSnapshots())
			.catch(() => [])
			.then((r) => {
				if (alive) records = r;
			});
		void import('$lib/ai/storage/artifacts').then((m) => {
			if (alive) repo = m.createArtifactRepo();
		});
		return () => {
			alive = false;
			void autosave.flush().finally(() => autosave.destroy());
		};
	});

	// Autosave the choices (ZIP, sections, statements, listings kind) after the restore.
	$effect(() => {
		if (!restored) return;
		const data = choicesData(loaded?.zip ?? initialZip, include);
		untrack(() => autosave.schedule(data));
	});

	// Save's own recheck result lasts until the notes change (the panel's gate takes over).
	$effect(() => {
		void draftText;
		untrack(() => (urgentReason = null));
	});

	// Draft history reloads after the panel saves or opens a draft.
	$effect(() => {
		void artifactId;
		untrack(() => refreshKey++);
	});

	function setZipBusy(v: boolean): void {
		zipBusy = v;
		if (v) loadStartedAt = Date.now();
	}

	function onZipLoaded(r: LoadedZip): void {
		const fetched = Date.parse(r.fetchedAt);
		// A fresh fetch is stamped after the click; a cache hit keeps its earlier fetch time.
		const fetchedNow = loadStartedAt !== null ? fetched >= loadStartedAt : true;
		zipSpend = r.source === 'sample' ? 'sample' : fetchedNow ? 'network' : 'cached';
		if (loaded?.zip !== r.zip) {
			listings = null;
			listingsSpend = null;
		}
		loaded = r;
		saveFailed = false;
	}

	function onListings(s: LoadedListings | null): void {
		listings = s;
		if (s === null) listingsSpend = null;
	}

	async function onOpen(a: AiArtifact): Promise<void> {
		await panel?.openArtifact(a);
	}

	function refuse(reason: string): void {
		reasonEl?.focus();
		announce(reason);
	}

	/** The reviewed notes as saved, with where they came from (the stored Phase 5 draft). */
	async function narrative(text: string, fresh: Finding[]): Promise<SnapshotNarrative> {
		const id = artifactId;
		const stored = id && repo ? await repo.get(id).catch(() => undefined) : undefined;
		if (id && repo && stored) {
			try {
				await repo.updateText(id, text, fresh);
				if (stored.status === 'draft') await repo.setStatus(id, 'acknowledged', new Date());
			} catch {
				// The draft's review status is a convenience; the snapshot keeps the reviewed text.
			}
		}
		const sampleOutput = stored ? stored.sample || stored.provider === 'fixture' : false;
		return {
			text,
			artifactId: stored ? stored.id : null,
			provider: stored && !sampleOutput ? stored.provider : null,
			model: stored && !sampleOutput ? stored.model : null,
			sampleOutput
		};
	}

	async function save(): Promise<void> {
		if (saving) return;
		if (gateReason || !loaded) {
			refuse(gateReason ?? STEP_EMPTY);
			return;
		}
		// The panel rechecks 300 ms after typing stops: check the text as it is right now.
		const text = draftText;
		const fresh = notesOn ? runChecks(text, postChecks) : [];
		const freshGate = notesGateFields({
			draftText: text,
			canExit: canExit && !fresh.some((f) => f.severity === 'block'),
			findings: fresh
		});
		if (notesOn && freshGate.mustFix > 0) {
			const reason = saveGateReason({
				hasData: true,
				dataSections: dataSections.length,
				notesOn,
				...freshGate,
				profileMissing,
				live
			});
			if (reason) {
				urgentReason = reason;
				await tick();
				refuse(reason);
				return;
			}
		}
		saving = true;
		saveFailed = false;
		try {
			const id = crypto.randomUUID();
			const record = buildSnapshotRecord({
				id,
				now: new Date().toISOString(),
				zip: loaded.zip,
				placeName: loaded.placeName,
				stats: loaded.stats,
				fetchedAt: loaded.fetchedAt,
				source: loaded.source,
				listings: listingsIncluded,
				narrative: notesOn ? await narrative(text, fresh) : null,
				options: { eho: include.eho, tranFooter: include.tranFooter, sections: include.sections },
				profile: recordProfile,
				sample: loaded.source === 'sample'
			});
			const { addSnapshot } = await import('$lib/storage/studio/snapshots-repo');
			await addSnapshot(record);
			await autosave.flush();
			announce(SAVED_ANNOUNCEMENT);
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve()
			await goto(`${resolve('/print/snapshot/')}?id=${encodeURIComponent(id)}`);
		} catch {
			saveFailed = true;
		} finally {
			saving = false;
		}
	}

	const card = 'flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6';
	const h2 = 'font-display text-heading font-semibold text-foreground';
	const muted = 'text-base leading-[1.6] text-muted-foreground';
	const GATED =
		'aria-disabled:border aria-disabled:border-border aria-disabled:bg-surface aria-disabled:text-muted-foreground aria-disabled:hover:bg-surface';
</script>

<div class="flex max-w-160 flex-col gap-12 md:gap-16" data-snapshot-builder>
	<div class="flex flex-col gap-4">
		<p class="max-w-prose text-base leading-[1.6] text-foreground">{LEAD}</p>
		<p class="text-label font-semibold text-foreground" data-report-label>{REPORT_LABEL}</p>
	</div>

	<section
		aria-labelledby={step(1)}
		aria-busy={zipBusy ? 'true' : undefined}
		class={card}
		data-step="1"
	>
		<h2 id={step(1)} class={h2}>1. Choose a ZIP code</h2>
		{#if modeReady && restored}
			<ZipPicker
				onLoaded={onZipLoaded}
				{sampleMode}
				{initialZip}
				bind:busy={() => zipBusy, setZipBusy}
			/>
		{:else}
			<p class="text-label text-muted-foreground">Loading your studio…</p>
		{/if}
	</section>

	<section aria-labelledby={step(2)} class={card} data-step="2">
		<h2 id={step(2)} class={h2}>2. Choose what to include</h2>
		{#if loaded}
			<SnapshotSectionToggles
				bind:value={include}
				zip={loaded.zip}
				profile={recordProfile}
				{onListings}
				data={toggleData}
			/>
		{:else}
			<p class={muted}>{STEP_EMPTY}</p>
		{/if}
	</section>

	<section aria-labelledby={step(3)} class={card} data-step="3">
		<h2 id={step(3)} class={h2}>3. Market notes</h2>
		{#if !loaded || !notesInputs}
			<p class={muted}>{STEP_EMPTY}</p>
		{:else if !notesOn}
			<p class={muted} data-notes-off>{NOTES_OFF}</p>
		{:else}
			<p class="flex items-start gap-2 {muted}">
				<Info size={16} class="mt-1.5 shrink-0" aria-hidden="true" />
				{NOTES_USES}
			</p>
			{#key factsKey}
				<GenerationPanel
					bind:this={panel}
					bind:canExit
					bind:blocked
					bind:findings
					bind:artifactId
					bind:draftText
					feature={FEATURE}
					promptId={PROMPT_ID}
					inputs={notesInputs}
					title="Market notes"
					headingLevel={3}
					generateLabel="Draft market notes"
					mailto={{ subject: `Market notes: ZIP ${loaded.zip}` }}
					containsClientData={false}
					{postChecks}
					checkGroups={SNAPSHOT_CHECK_GROUPS}
					subjectId={loaded.zip}
					onExit={() => refreshKey++}
				/>
			{/key}
			{#if repo}
				<DraftHistory
					feature={FEATURE}
					{repo}
					headingLevel={3}
					subjectId={loaded.zip}
					onOpen={(a) => void onOpen(a)}
					{refreshKey}
				/>
			{/if}
		{/if}
	</section>

	<section aria-labelledby={step(4)} class={card} data-step="4">
		<h2 id={step(4)} class={h2}>4. Save and print</h2>
		{#if loaded}
			<dl
				class="grid gap-2 text-base leading-[1.6] tabular-nums sm:grid-cols-[auto_1fr] sm:gap-x-6"
			>
				<dt class="font-semibold text-foreground">ZIP data</dt>
				<dd class="text-foreground" data-cost-zip>
					{zipSpend ? spendText(zipSpend) : ''} · as of {asOfText}
				</dd>
				<dt class="font-semibold text-foreground">Listings summary</dt>
				<dd class="text-foreground" data-cost-listings>
					{listingsIncluded ? (listingsSpend ? spendText(listingsSpend) : '') : 'Not included'}
				</dd>
				<dt class="font-semibold text-foreground">Market notes</dt>
				<dd class="text-foreground" data-cost-notes>
					{notesSummary(notesOn, notes.notesStatus === 'ready')}
				</dd>
			</dl>
		{:else}
			<p class={muted}>{STEP_EMPTY}</p>
		{/if}
		<div class="flex flex-col gap-2">
			<div>
				<Button
					class="h-12 w-full sm:w-auto {GATED}"
					aria-disabled={shownReason ? 'true' : undefined}
					aria-describedby={shownReason ? reasonId : undefined}
					onclick={save}
					data-save-snapshot
				>
					{#if saving}
						<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
						Saving…
					{:else}
						<Printer size={16} aria-hidden="true" />
						Save and open print view
					{/if}
				</Button>
			</div>
			{#if shownReason}
				<p
					id={reasonId}
					bind:this={reasonEl}
					tabindex="-1"
					class="text-label font-semibold text-foreground focus:outline-none"
					data-save-reason
				>
					{shownReason}
				</p>
			{/if}
		</div>
		{#if saveFailed}
			<SectionError title={SAVE_FAILED_TITLE} body={SAVE_FAILED_BODY} focusOnMount={true} />
		{/if}
	</section>

	<SnapshotList
		{records}
		onDeleted={(id) => (records = (records ?? []).filter((r) => r.id !== id))}
	/>
</div>
