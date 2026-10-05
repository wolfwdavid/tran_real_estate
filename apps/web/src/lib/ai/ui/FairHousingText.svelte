<script lang="ts">
	// Read-mode renderer: plain text with each finding wrapped in <mark> + a popover trigger.
	// Built from text segments (segmentText), never raw HTML injection, so the draft renders exactly.
	// Four non-color cues per finding: icon shape, solid/dashed underline, a visually hidden prefix,
	// and the worded row in FindingsSummary. Exported for Phase 9 user-typed copy.
	import OctagonAlert from '@lucide/svelte/icons/octagon-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { Finding } from '@tran/core/fair-housing';
	import { segmentText } from './panel-controller';
	import FindingPopover from './FindingPopover.svelte';

	let {
		text,
		findings,
		idPrefix,
		onApply,
		onEdit,
		openId = $bindable(null)
	}: {
		text: string;
		findings: Finding[];
		idPrefix: string;
		onApply?: (findingId: string) => void;
		onEdit?: (findingId: string) => void;
		openId?: string | null;
	} = $props();

	const segments = $derived(segmentText(text, findings));

	const PREFIX = {
		block: 'Fair Housing problem, must fix: ',
		warn: 'Fair Housing caution, review: '
	} as const;

	// Classes are written out in full (no tailwind-merge) so the custom text-* sizes survive.
	// [box-decoration-break:clone] keeps the fill and underline on every line of a wrapped phrase;
	// hover: is gated on (hover: hover) by Tailwind v4, so the 3px underline is pointer-only.
	const MARK = {
		block: 'finding finding--block bg-accent-surface text-foreground [box-decoration-break:clone]',
		warn: 'finding finding--warn bg-surface text-foreground [box-decoration-break:clone]'
	} as const;
	const TRIGGER_BASE =
		'finding-trigger m-0 cursor-pointer touch-manipulation border-0 bg-transparent p-0 text-left [font:inherit] text-inherit underline decoration-2 underline-offset-[3px] [box-decoration-break:clone] hover:decoration-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
	const TRIGGER = {
		block: `${TRIGGER_BASE} decoration-destructive decoration-solid`,
		warn: `${TRIGGER_BASE} decoration-foreground decoration-dashed`
	} as const;
	const ICON = {
		block: 'mr-0.5 inline-block align-[-0.125em] text-destructive',
		warn: 'mr-0.5 inline-block align-[-0.125em] text-foreground'
	} as const;
</script>

<span class="whitespace-pre-wrap"
	>{#each segments as seg, i (seg.kind === 'finding' ? seg.finding.id : `t${i}`)}{#if seg.kind === 'text'}{seg.value}{:else}{@const f =
				seg.finding}<mark class={MARK[f.severity]}
				><FindingPopover
					finding={f}
					{idPrefix}
					{onApply}
					{onEdit}
					bind:open={
						() => openId === f.id, (v) => (openId = v ? f.id : openId === f.id ? null : openId)
					}
					>{#snippet trigger(props)}<button
							{...props}
							type="button"
							aria-haspopup="dialog"
							class={TRIGGER[f.severity]}
							>{#if f.severity === 'block'}<OctagonAlert
									size={16}
									aria-hidden="true"
									class={ICON.block}
								/>{:else}<TriangleAlert size={16} aria-hidden="true" class={ICON.warn} />{/if}<span
								class="sr-only">{PREFIX[f.severity]}</span
							>{f.phrase}</button
						>{/snippet}</FindingPopover
				></mark
			>{/if}{/each}</span
>
