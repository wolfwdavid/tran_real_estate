<script lang="ts">
	// Result region under the draft (05-UI-SPEC "FindingsSummary anatomy"). Titles come from
	// findingsTitle: 'No Fair Housing problem phrases found' / 'Fair Housing check: {n} to fix, …'.
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

	let {
		findings,
		idPrefix,
		headingLevel,
		checking = false,
		acknowledged = $bindable(false),
		onApply,
		onShow
	}: {
		findings: Finding[];
		idPrefix: string;
		headingLevel: 3 | 4;
		checking?: boolean;
		acknowledged?: boolean;
		onApply?: (findingId: string) => void;
		onShow?: (findingId: string) => void;
	} = $props();

	const titleId = $derived(`${idPrefix}-findings-title`);
	const ackId = $derived(`${idPrefix}-findings-ack`);
	const tag = $derived(`h${headingLevel}`);
	const byStart = (a: Finding, b: Finding) => a.start - b.start;
	const blocks = $derived(findings.filter((f) => f.severity === 'block').sort(byStart));
	const warns = $derived(findings.filter((f) => f.severity === 'warn').sort(byStart));
	// All Must fix rows first, then Review rows, each in reading order.
	const rows = $derived([...blocks, ...warns]);
	const title = $derived(findingsTitle(blocks.length, warns.length));
	const showAck = $derived(blocks.length === 0 && warns.length > 0);

	const removes = (f: Finding) =>
		(f.members.find((m) => m.severity === 'block') ?? f.members[0])?.alternative === '';
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

<div role="region" aria-labelledby={titleId} class="flex flex-col gap-4">
	{#if checking}
		<p id={titleId} tabindex="-1" class="text-label text-muted-foreground">
			{CHECKING}
		</p>
	{:else if rows.length === 0}
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
		<ol class="flex flex-col gap-4">
			{#each rows as f (f.id)}
				{@const phraseId = `${idPrefix}-finding-${f.id}-row`}
				<li class="flex flex-col gap-1">
					{#if f.severity === 'block'}
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
						<Button
							variant="outline"
							class="min-h-11"
							aria-describedby={phraseId}
							onclick={() => onApply?.(f.id)}
						>
							{removes(f) ? 'Remove phrase' : 'Use alternative'}
						</Button>
						<Button
							variant="ghost"
							class="min-h-11"
							aria-describedby={phraseId}
							onclick={() => onShow?.(f.id)}
						>
							Show in draft
						</Button>
					</div>
				</li>
			{/each}
		</ol>
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
