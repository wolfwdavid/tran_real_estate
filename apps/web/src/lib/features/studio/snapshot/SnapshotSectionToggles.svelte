<script lang="ts" module>
	import { FALLBACK_NAMES, type BrandRole } from '@tran/brand/brand-color';
	import type { ProfileInput } from '@tran/core/agent/types';
	import type { AggregatedSample } from '@tran/core/studio';
	import { effectiveBrandColors } from '$lib/features/shared/agent-profile';
	import { SNAPSHOT_SECTION_KEYS, type SnapshotSectionKey } from '$lib/storage/studio/types';
	import type { ListingsKind } from './snapshot-data';

	export interface SnapshotIncludeValue {
		sections: SnapshotSectionKey[];
		eho: boolean;
		tranFooter: boolean;
		/** null: the active listings summary is not included. */
		listingsKind: ListingsKind | null;
	}

	/** Step 2 defaults: every section, both statements, no listings summary. */
	export const DEFAULT_INCLUDE: Readonly<SnapshotIncludeValue> = Object.freeze({
		sections: [...SNAPSHOT_SECTION_KEYS],
		eho: true,
		tranFooter: true,
		listingsKind: null
	});

	/** The six report sections in report order, with the UI-SPEC titles and descriptions. */
	export const SECTION_ROWS: readonly {
		key: SnapshotSectionKey;
		title: string;
		description: string;
	}[] = [
		{ key: 'keyFigures', title: 'Key figures', description: 'The main numbers at a glance.' },
		{
			key: 'rentTrend',
			title: 'Rent trend chart',
			description: 'Median rent by bedroom count, month by month.'
		},
		{
			key: 'priceToRent',
			title: 'Price-to-rent chart',
			description: 'How list prices compare with a year of rent.'
		},
		{
			key: 'rentByBedroom',
			title: 'Rent by bedroom table',
			description: "Median rent and how many listings it's based on."
		},
		{
			key: 'domInventory',
			title: 'Days on market and inventory table',
			description: 'How long listings stay up and how many there are.'
		},
		{
			key: 'marketNotes',
			title: 'Market notes',
			description: 'A few short paragraphs, drafted with AI from these numbers, that you review.'
		}
	];

	/** Market notes only narrate the figures, so they are not a data section on their own. */
	export const DATA_SECTION_KEYS: readonly SnapshotSectionKey[] = SNAPSHOT_SECTION_KEYS.filter(
		(k) => k !== 'marketNotes'
	);

	export const SECTIONS_REQUIRED = 'Choose at least one section with market data.';

	/** null when at least one data section is checked, else the validation message. */
	export function validateSections(sections: readonly SnapshotSectionKey[]): string | null {
		return sections.some((s) => DATA_SECTION_KEYS.includes(s)) ? null : SECTIONS_REQUIRED;
	}

	export const ALWAYS_INCLUDED =
		'Always included: the market-information label, your name, brokerage and license details, where the data came from, and the date.';

	export const EHO_TITLE = 'Equal Housing Opportunity.';
	export const EHO_SENTENCE =
		'We are pledged to the letter and spirit of U.S. policy for the achievement of equal housing opportunity throughout the Nation.';

	const ROLE_TITLE: Record<BrandRole, string> = { primary: 'Primary', accent: 'Accent' };

	/** One note per brand color the report can't use, naming the Tran color it falls back to. */
	export function brandFallbackNotes(profile: ProfileInput | null): string[] {
		if (profile === null) return [];
		const eff = effectiveBrandColors(profile);
		const notes: string[] = [];
		const raw: Record<BrandRole, string> = {
			primary: profile.brandPrimary,
			accent: profile.brandAccent
		};
		const fromAgent: Record<BrandRole, boolean> = {
			primary: eff.primaryFromAgent,
			accent: eff.accentFromAgent
		};
		for (const role of ['primary', 'accent'] as const) {
			if (fromAgent[role]) continue;
			notes.push(
				raw[role].trim() === ''
					? `No ${role} color chosen. Reports use Tran's ${FALLBACK_NAMES[role]}.`
					: `${ROLE_TITLE[role]} color is too low in contrast. Reports will use Tran's ${FALLBACK_NAMES[role]}.`
			);
		}
		return notes;
	}

	export interface LoadedListings {
		sample: AggregatedSample;
		fetchedAt: string;
	}
</script>

<script lang="ts">
	// 09-UI-SPEC "Step 2: Choose what to include" (STU-04). Section and statement toggles write the
	// bindable value. The active listings summary is opt-in: its cost preview is read from the
	// change handlers (free), and Load listings summary is the only spend, from its click handler,
	// through loadListingsSummary (aggregates only, the ledger cap and the confirm prompt apply).
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { EMPTY_PROFILE_INPUT, type AgentProfile } from '@tran/core/agent/types';
	import { getDataRuntime, isGatewayError, type GatewayError as GatewayErrorType } from '$lib/data';
	import { BrandPreview } from '$lib/features/shared/agent-profile';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import { Button, announce } from '$lib/features/shared/data/platform-ui';
	import ListingsSummaryTable from './ListingsSummaryTable.svelte';
	import { createSnapshotData, type CostPreview, type SnapshotData } from './snapshot-data';
	import { toEstimate } from './ZipPicker.svelte';

	interface Props {
		value: SnapshotIncludeValue;
		zip: string;
		profile: AgentProfile | ProfileInput | null;
		onListings: (s: LoadedListings | null) => void;
		/** The snapshot data path; defaults to the app's data runtime (Svelte context). */
		data?: SnapshotData;
		/** Clock for the summary's provenance chip. */
		now?: number;
	}

	let { value = $bindable(), zip, profile, onListings, data, now }: Props = $props();

	const snap: SnapshotData = untrack(() => data ?? createSnapshotData(getDataRuntime()));

	const uid = $props.id();
	const sectionsErrorId = `${uid}-sections-error`;
	const listingsId = `${uid}-listings`;
	const ehoId = `${uid}-eho`;
	const footerId = `${uid}-footer`;

	let listingsCost = $state<CostPreview | null>(null);
	let loadingListings = $state(false);
	let listingsError = $state<GatewayErrorType | null>(null);
	let summary = $state<
		(LoadedListings & { zip: string; kind: ListingsKind; sampleData: boolean }) | null
	>(null);

	const sectionsError = $derived(validateSections(value.sections));
	const previewProfile = $derived<ProfileInput>(profile ?? EMPTY_PROFILE_INPUT);
	const fallbackNotes = $derived(brandFallbackNotes(profile));
	const shownSummary = $derived(
		summary && summary.zip === zip && summary.kind === value.listingsKind ? summary : null
	);

	/** Free: the summary's cost preview for the chosen kind (cache / fixtures only). */
	function readListingsCost(kind: ListingsKind): void {
		listingsCost = null;
		const forZip = zip;
		void snap
			.listingsSummaryCost(forZip, kind)
			.then((c) => {
				if (value.listingsKind === kind && zip === forZip) listingsCost = c;
			})
			.catch(() => {
				listingsCost = null;
			});
	}

	onMount(() => {
		if (value.listingsKind) readListingsCost(value.listingsKind);
	});

	function toggleSection(key: SnapshotSectionKey, on: boolean): void {
		const next = on ? [...value.sections, key] : value.sections.filter((k) => k !== key);
		// Canonical report order whatever the click order.
		value = { ...value, sections: SNAPSHOT_SECTION_KEYS.filter((k) => next.includes(k)) };
	}

	function clearSummary(): void {
		listingsError = null;
		if (summary) {
			summary = null;
			onListings(null);
		}
	}

	function toggleListings(on: boolean): void {
		clearSummary();
		const kind: ListingsKind | null = on ? 'sale' : null;
		value = { ...value, listingsKind: kind };
		if (kind) readListingsCost(kind);
		else onListings(null);
	}

	function chooseKind(kind: ListingsKind): void {
		if (value.listingsKind === kind) return;
		clearSummary();
		value = { ...value, listingsKind: kind };
		readListingsCost(kind);
	}

	async function loadListings(): Promise<void> {
		const kind = value.listingsKind;
		if (loadingListings || !kind) return;
		loadingListings = true;
		listingsError = null;
		const forZip = zip;
		const sampleData = listingsCost?.sample ?? false;
		try {
			const r = await snap.loadListingsSummary(forZip, kind);
			summary = { ...r, zip: forZip, kind, sampleData };
			listingsCost = { calls: 0, cached: !sampleData, sample: sampleData };
			const n = r.sample.total;
			announce(`Listings summary loaded: ${n} ${n === 1 ? 'listing' : 'listings'}.`);
			onListings(r);
		} catch (error) {
			if (!isGatewayError(error)) throw error;
			if (error.kind === 'BudgetCapReached' && error.detail === 'dismissed') return;
			listingsError = error;
		} finally {
			loadingListings = false;
		}
	}

	const legend = 'text-base leading-[1.6] font-semibold text-foreground';
	const checkRow = 'flex min-h-11 cursor-pointer touch-manipulation items-start gap-2 py-2';
	const checkbox = 'mt-1 size-5 shrink-0 accent-primary';
	const title = 'text-base leading-[1.6] font-semibold text-foreground';
	const desc = 'text-base leading-[1.6] text-muted-foreground';
	const chip = (checked: boolean) =>
		[
			'relative inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-1 rounded-full border px-4 text-base leading-[1.6]',
			'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring',
			checked
				? 'border-foreground bg-foreground font-semibold text-card'
				: 'border-input bg-card font-normal text-foreground'
		].join(' ');
	const HIDDEN_INPUT = 'absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0';
	const KINDS: readonly { kind: ListingsKind; label: string }[] = [
		{ kind: 'sale', label: 'Homes for sale' },
		{ kind: 'rental', label: 'Rentals' }
	];
</script>

<div class="flex flex-col gap-8" data-snapshot-section-toggles>
	<fieldset
		class="flex min-w-0 flex-col gap-2"
		aria-describedby={sectionsError ? sectionsErrorId : undefined}
	>
		<legend class={legend}>Report sections</legend>
		{#each SECTION_ROWS as row (row.key)}
			{@const id = `${uid}-${row.key}`}
			<div class={checkRow}>
				<input
					{id}
					type="checkbox"
					class={checkbox}
					checked={value.sections.includes(row.key)}
					aria-describedby="{id}-desc"
					onchange={(e) => toggleSection(row.key, e.currentTarget.checked)}
				/>
				<div class="flex min-w-0 flex-col">
					<label for={id} class="{title} cursor-pointer">{row.title}</label>
					<p id="{id}-desc" class={desc}>{row.description}</p>
				</div>
			</div>
		{/each}
		{#if sectionsError}
			<p id={sectionsErrorId} class="flex items-center gap-1 text-label text-destructive">
				<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{sectionsError}
			</p>
		{/if}

		<div class="mt-2 flex flex-col gap-4 border-t border-border pt-4">
			<div class={checkRow}>
				<input
					id={listingsId}
					type="checkbox"
					class={checkbox}
					checked={value.listingsKind !== null}
					aria-describedby="{listingsId}-desc"
					onchange={(e) => toggleListings(e.currentTarget.checked)}
				/>
				<div class="flex min-w-0 flex-col">
					<label for={listingsId} class="{title} cursor-pointer"
						>Active listings summary (1 call)</label
					>
					<p id="{listingsId}-desc" class={desc}>
						Counts, price ranges, and medians by bedroom count. No addresses or photos, so the
						report never advertises another agent's listing.
					</p>
				</div>
			</div>

			{#if value.listingsKind !== null}
				<div
					class="flex flex-col gap-4"
					aria-busy={loadingListings ? 'true' : undefined}
					data-listings-options
				>
					<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Listings to summarize">
						{#each KINDS as k (k.kind)}
							{@const checked = value.listingsKind === k.kind}
							<label class={chip(checked)}>
								<input
									type="radio"
									name="{uid}-listings-kind"
									class={HIDDEN_INPUT}
									value={k.kind}
									{checked}
									onchange={() => chooseKind(k.kind)}
								/>
								{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
								{k.label}
							</label>
						{/each}
					</div>
					<div>
						<Button variant="outline" disabled={loadingListings} onclick={loadListings}>
							{#if loadingListings}
								<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
								Loading…
							{:else}
								Load listings summary <CostLabel estimate={toEstimate(listingsCost)} />
							{/if}
						</Button>
					</div>
					{#if listingsError}
						<GatewayError
							error={listingsError}
							focusOnMount={true}
							onTryAgain={loadListings}
							onContinuePastCap={() => void loadListings()}
						/>
					{:else if shownSummary}
						<ProvenanceChip
							provenance={{
								source: shownSummary.sampleData ? 'sample' : 'rentcast',
								fetchedAt: Date.parse(shownSummary.fetchedAt),
								stale: false
							}}
							{now}
						/>
						<ListingsSummaryTable sample={shownSummary.sample} {zip} />
					{/if}
				</div>
			{/if}
		</div>
	</fieldset>

	<fieldset class="flex min-w-0 flex-col gap-4">
		<legend class={legend}>Branding and statements</legend>
		<BrandPreview profile={previewProfile} />
		{#each fallbackNotes as note (note)}
			<p class="text-label text-muted-foreground">{note}</p>
		{/each}
		<p>
			<a
				href={resolve('/agent/profile/')}
				class="inline-flex min-h-11 items-center text-base leading-[1.6] text-foreground underline underline-offset-2"
				>Edit logo and colors in your profile</a
			>
		</p>
		<div class={checkRow}>
			<input
				id={ehoId}
				type="checkbox"
				class={checkbox}
				checked={value.eho}
				onchange={(e) => (value = { ...value, eho: e.currentTarget.checked })}
				aria-describedby="{ehoId}-desc"
			/>
			<div class="flex min-w-0 flex-col">
				<label for={ehoId} class="{title} cursor-pointer"
					>Include the Equal Housing Opportunity statement</label
				>
				<p id="{ehoId}-desc" class={desc}>{EHO_TITLE} {EHO_SENTENCE}</p>
			</div>
		</div>
		<label class={checkRow} for={footerId}>
			<input
				id={footerId}
				type="checkbox"
				class={checkbox}
				checked={value.tranFooter}
				onchange={(e) => (value = { ...value, tranFooter: e.currentTarget.checked })}
			/>
			<span class={title}>Include "Prepared with Tran Real Estate Tools" at the bottom</span>
		</label>
		<p class="text-label text-muted-foreground">{ALWAYS_INCLUDED}</p>
	</fieldset>
</div>
