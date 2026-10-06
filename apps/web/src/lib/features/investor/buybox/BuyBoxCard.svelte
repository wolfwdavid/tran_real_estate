<script lang="ts">
	// BuyBoxCard (07-UI-SPEC "Buy boxes"): name + criteria summary, the Phase 4 NewSinceBadge with
	// "Checked {relative}" (or the never-checked line), Check now ({cost}) · Edit · Delete, and the
	// Matches disclosure (open by default when there are new matches) with rows below the user's
	// targets grouped under "Show {n} below your targets". Every figure here was read from the
	// cache by the page (0 calls); the only spends are the page's Check now handler and the match
	// rows' click handlers.
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { GatewayError as GatewayErrorType } from '@tran/core/request';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import NewSinceBadge from '$lib/features/shared/data/NewSinceBadge.svelte';
	import { Button, ConfirmDialog } from '$lib/features/shared/data/platform-ui';
	import type { MarketsPort } from '$lib/features/shared/markets/markets-port';
	import type { CostEstimate, InvestorDataPort } from '../data/investor-port';
	import type { BuyBoxView } from './buyBoxRepo';
	import { criteriaSummary } from './buybox-form';
	import type { LoadedMatches } from './matches';
	import MatchRow from './MatchRow.svelte';

	interface Props {
		box: BuyBoxView;
		headingId: string;
		/** Cached matches (undefined while reading), or the cached error for the location. */
		matches: LoadedMatches | undefined;
		matchesError: GatewayErrorType | null;
		newCount: number;
		checkCost: CostEstimate | null;
		checking: boolean;
		checkError: { error: GatewayErrorType; retry?: () => void } | null;
		sample: boolean;
		investor: InvestorDataPort;
		markets: MarketsPort;
		onCheck: () => void;
		onCheckCostRefresh: () => void;
		onEdit: () => void;
		onDelete: () => Promise<void>;
		onDeleteCloseAutoFocus: (e: Event) => void;
		/** The user opened the matches: the page marks them seen when the visit ends. */
		onMatchesOpened: () => void;
		onZipLoaded: (zip: string) => Promise<void>;
	}

	let {
		box,
		headingId,
		matches,
		matchesError,
		newCount,
		checkCost,
		checking,
		checkError,
		sample,
		investor,
		markets,
		onCheck,
		onCheckCostRefresh,
		onEdit,
		onDelete,
		onDeleteCloseAutoFocus,
		onMatchesOpened,
		onZipLoaded
	}: Props = $props();

	let confirmOpen = $state(false);

	const targeted = $derived(
		box.targets.minCapRatePct !== null || box.targets.minRentToPricePct !== null
	);
	const total = $derived((matches?.meeting.length ?? 0) + (matches?.below.length ?? 0));
	const meetCount = $derived(matches?.meeting.filter((r) => r.meets === true).length ?? 0);
	const summary = $derived(
		targeted ? `Matches (${meetCount} meet your targets)` : `Matches (${total})`
	);
	const needing = $derived(new Set(matches?.zipsNeedingStats ?? []));
	const hasNew = $derived(!!matches && [...matches.meeting, ...matches.below].some((r) => r.isNew));

	function onToggle(e: Event) {
		if ((e.currentTarget as HTMLDetailsElement).open) onMatchesOpened();
	}
</script>

{#snippet rows(list: LoadedMatches['meeting'])}
	<ul class="divide-y divide-border">
		{#each list as row (row.listing.id)}
			<li>
				<MatchRow
					{row}
					{sample}
					{investor}
					{markets}
					needsStats={row.quick === null && needing.has(row.listing.zip)}
					{onZipLoaded}
				/>
			</li>
		{/each}
	</ul>
{/snippet}

<article
	class="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6"
	data-buy-box={box.id}
	aria-labelledby={headingId}
>
	<div class="flex min-w-0 flex-col gap-1">
		<h2
			id={headingId}
			tabindex="-1"
			class="text-base leading-[1.6] font-semibold break-words text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			{box.name}
		</h2>
		<p class="text-base leading-[1.6] break-words text-muted-foreground">{criteriaSummary(box)}</p>
	</div>

	{#if box.lastRunAt === null}
		<p class="text-base leading-[1.6] text-muted-foreground" data-not-checked>
			Not checked yet. Use Check now, or Tran will check it next time you open the app.
		</p>
	{:else}
		<NewSinceBadge
			{newCount}
			priceChanged={0}
			gone={0}
			checkedAt={box.lastRunAt}
			source={sample ? 'sample' : 'rentcast'}
		/>
	{/if}

	<div class="flex flex-wrap gap-2">
		<Button
			variant="outline"
			class="h-auto min-h-11 max-w-full shrink py-2 text-left whitespace-normal"
			aria-disabled={checking ? 'true' : undefined}
			onclick={onCheck}
			onpointerenter={onCheckCostRefresh}
			onfocus={onCheckCostRefresh}
		>
			{#if checking}
				<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
				Checking…
			{:else}
				Check now <CostLabel estimate={checkCost} />
			{/if}
		</Button>
		<Button variant="ghost" class="min-h-11" onclick={onEdit}>Edit</Button>
		<ConfirmDialog
			bind:open={confirmOpen}
			title={`Delete ${box.name}?`}
			body={[
				"This removes the buy box and its saved matches from this browser. Tran will stop checking it. It can't be undone."
			]}
			confirmLabel="Delete buy box"
			confirmBusyLabel="Deleting…"
			cancelLabel="Keep buy box"
			onConfirm={onDelete}
			onCloseAutoFocus={onDeleteCloseAutoFocus}
		>
			{#snippet trigger({ props })}
				<Button {...props} variant="destructive-outline" class="min-h-11">Delete</Button>
			{/snippet}
		</ConfirmDialog>
	</div>

	{#if checkError}
		<GatewayError
			error={checkError.error}
			focusOnMount
			onTryAgain={async () => onCheck()}
			onContinuePastCap={checkError.retry}
			body={checkError.error.kind === 'NoResults'
				? 'No homes for sale match this buy box right now. Tran will check again tomorrow when you open the app.'
				: undefined}
		/>
	{:else if matchesError}
		<GatewayError
			error={matchesError}
			actions={false}
			body={matchesError.kind === 'NoResults'
				? 'No homes for sale match this buy box right now. Tran will check again tomorrow when you open the app.'
				: undefined}
		/>
	{/if}

	{#if matches && (matches.checked || box.lastRunAt !== null)}
		<details class="min-w-0" open={hasNew} ontoggle={onToggle} data-matches>
			<summary
				class="inline-flex min-h-11 cursor-pointer touch-manipulation items-center text-base leading-[1.6] font-semibold text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>{summary}</summary
			>
			{#if total === 0}
				<p class="mt-2 text-base leading-[1.6] text-foreground" data-no-matches>
					No homes for sale match this buy box right now. Tran will check again tomorrow when you
					open the app.
				</p>
			{:else}
				{#if matches.truncated}
					<p class="mt-2 text-label text-muted-foreground" data-truncated>
						RentCast returned its maximum of 500 homes for this location, so some may be missing. A
						smaller area, like a ZIP code, shows more of them.
					</p>
				{/if}
				{@render rows(matches.meeting)}
				{#if matches.below.length > 0}
					<details class="mt-2 min-w-0" data-below-targets>
						<summary
							class="inline-flex min-h-11 cursor-pointer touch-manipulation items-center text-base leading-[1.6] font-semibold text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
							>Show {matches.below.length} below your targets</summary
						>
						{@render rows(matches.below)}
					</details>
				{/if}
			{/if}
		</details>
	{/if}
</article>
