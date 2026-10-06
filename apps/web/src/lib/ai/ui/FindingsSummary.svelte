<script lang="ts">
	// Result region under the draft (05-UI-SPEC "FindingsSummary anatomy"). Titles come from
	// findingsTitle: 'No Fair Housing problem phrases found' / 'Fair Housing check: {n} to fix, …'.
	// Phase 7: checkGroups adds one titled group per post-check after Fair Housing.
	// The title element `${idPrefix}-findings-title` takes tabindex="-1" so the panel can move focus
	// to it after the last finding is resolved or a gated exit is activated.
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import OctagonAlert from '@lucide/svelte/icons/octagon-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { Finding } from '@tran/core/fair-housing';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { findingsTitle } from './panel-controller';
	import { groupCopyFor, groupFindings, type CheckGroupCopy } from './post-check';

	let {
		findings,
		idPrefix,
		headingLevel,
		checking = false,
		acknowledged = $bindable(false),
		checkGroups = [],
		onApply,
		onShow,
		onEdit
	}: {
		findings: Finding[];
		idPrefix: string;
		headingLevel: 3 | 4;
		checking?: boolean;
		acknowledged?: boolean;
		/**
		 * Phase 7: post-check groups rendered after Fair Housing, each with its own title. Absent:
		 * every finding stays in the Fair Housing group (Phase 5 output, unchanged).
		 */
		checkGroups?: readonly CheckGroupCopy[];
		onApply?: (findingId: string) => void;
		onShow?: (findingId: string) => void;
		/** "Edit it myself" on post-check rows that offer no automatic fix. */
		onEdit?: (findingId: string) => void;
	} = $props();

	type Row = { f: Finding; severity: 'block' | 'warn'; apply: boolean; removes: boolean };

	const titleId = $derived(`${idPrefix}-findings-title`);
	const ackId = $derived(`${idPrefix}-findings-ack`);
	const tag = $derived(`h${headingLevel}`);
	const byStart = (a: Row, b: Row) => a.f.start - b.f.start;
	const groups = $derived(
		groupFindings(findings, checkGroups).map((g) => {
			const rows = g.findings.map((f): Row => {
				// A group only speaks for its own members; the Fair Housing group owns all members
				// when there are no checkGroups (Phase 5).
				const mine = f.members.filter((m) => groupCopyFor(m, checkGroups) === g.copy);
				const severity = mine.some((m) => m.severity === 'block') ? 'block' : 'warn';
				const primary = mine.find((m) => m.severity === 'block') ?? mine[0];
				const removes = primary?.alternative === '';
				return { f, severity, apply: !(g.copy && !g.copy.allowRemovePhrase && removes), removes };
			});
			// All Must fix rows first, then Review rows, each in reading order.
			const sorted = [
				...rows.filter((r) => r.severity === 'block').sort(byStart),
				...rows.filter((r) => r.severity === 'warn').sort(byStart)
			];
			return { ...g, rows: sorted };
		})
	);
	const fh = $derived(groups[0]!);
	const extra = $derived(groups.slice(1));
	const rows = $derived(fh.rows);
	const title = $derived(findingsTitle(fh.blockCount, fh.warnCount));
	// Phase 5 rule over ALL findings: the checkbox only shows with 0 must-fix and >= 1 review.
	const globalBlocks = $derived(findings.filter((f) => f.severity === 'block').length);
	const showAck = $derived(globalBlocks === 0 && findings.length > 0);

	const categories = (f: Finding) => [...new Set(f.members.map((m) => m.categoryLabel))].join(', ');
	const TITLE_CLASS = 'text-body font-semibold text-foreground';

	// 05-UI-SPEC "Fair Housing findings" copy, verbatim.
	const CHECKING = 'Checking for Fair Housing problem phrases…';
	const LIMITS_NOTE =
		"This check looks for known problem phrases. It can't catch everything, so read the draft before you use it.";
	const LEGAL_NOTE =
		"These flags are a plain-language check based on published Fair Housing advertising guidance. They're not legal advice.";
	const ACK =
		"I've reviewed the flagged phrases. They describe the property, not who should live there.";
</script>

{#snippet rowList(list: Row[], rowPrefix: string)}
	<ol class="flex flex-col gap-4">
		{#each list as r (r.f.id)}
			{@const f = r.f}
			{@const phraseId = `${rowPrefix}-finding-${f.id}-row`}
			<li class="flex flex-col gap-1">
				{#if r.severity === 'block'}
					<p class="flex items-center gap-1 text-label font-semibold text-destructive">
						<OctagonAlert size={16} aria-hidden="true" class="shrink-0" />
						Must fix
					</p>
				{:else}
					<p class="flex items-center gap-1 text-label font-semibold text-foreground">
						<TriangleAlert size={16} aria-hidden="true" class="shrink-0" />
						Review
					</p>
				{/if}
				<p id={phraseId} class="text-body font-semibold text-foreground">“{f.phrase}”</p>
				<p class="text-body text-muted-foreground">{categories(f)}</p>
				<div class="flex flex-wrap gap-2 pt-1">
					{#if r.apply}
						<Button
							variant="outline"
							class="min-h-11"
							aria-describedby={phraseId}
							onclick={() => onApply?.(f.id)}
						>
							{r.removes ? 'Remove phrase' : 'Use alternative'}
						</Button>
					{/if}
					<Button
						variant="ghost"
						class="min-h-11"
						aria-describedby={phraseId}
						onclick={() => onShow?.(f.id)}
					>
						Show in draft
					</Button>
					{#if !r.apply}
						<Button
							variant="outline"
							class="min-h-11"
							aria-describedby={phraseId}
							onclick={() => onEdit?.(f.id)}
						>
							Edit it myself
						</Button>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
{/snippet}

<div role="region" aria-labelledby={titleId} class="flex flex-col gap-4">
	{#if checking}
		<p id={titleId} tabindex="-1" class="text-label text-muted-foreground">
			{CHECKING}
		</p>
	{:else}
		{#if rows.length === 0}
			<div class="flex items-start gap-2 rounded-lg bg-secondary-surface p-4">
				<CircleCheck size={20} aria-hidden="true" class="mt-0.5 shrink-0 text-secondary" />
				<div class="flex flex-col gap-1">
					<svelte:element this={tag} id={titleId} tabindex="-1" class={TITLE_CLASS}>
						{title}
					</svelte:element>
					<p class="text-body text-foreground">
						{LIMITS_NOTE}
					</p>
				</div>
			</div>
		{:else}
			<div class="flex flex-col gap-1">
				<svelte:element this={tag} id={titleId} tabindex="-1" class={TITLE_CLASS}>
					{title}
				</svelte:element>
				<p class="text-label text-muted-foreground">
					{LEGAL_NOTE}
				</p>
			</div>
			{@render rowList(rows, idPrefix)}
		{/if}
		{#each extra as g (g.checker)}
			{@const copy = g.copy!}
			{#if g.rows.length === 0}
				<div class="flex items-start gap-2 rounded-lg bg-secondary-surface p-4">
					<CircleCheck size={20} aria-hidden="true" class="mt-0.5 shrink-0 text-secondary" />
					<div class="flex flex-col gap-1">
						<svelte:element this={tag} class={TITLE_CLASS}>
							{copy.passedTitle}
						</svelte:element>
						{#if copy.passedNote}
							<p class="text-body text-foreground">{copy.passedNote}</p>
						{/if}
					</div>
				</div>
			{:else}
				<svelte:element this={tag} class={TITLE_CLASS}>
					{copy.findingsTitle(g.blockCount, g.warnCount)}
				</svelte:element>
				{@render rowList(g.rows, `${idPrefix}-${g.checker}`)}
			{/if}
		{/each}
		{#if showAck}
			<div class="flex min-h-11 items-center gap-3">
				<Checkbox id={ackId} bind:checked={acknowledged} />
				<Label for={ackId} class="cursor-pointer font-normal">
					{ACK}
				</Label>
			</div>
		{/if}
	{/if}
</div>
