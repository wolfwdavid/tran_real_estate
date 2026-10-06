<script lang="ts">
	// Popover body for one merged finding (05-UI-SPEC "FairHousingText + FindingPopover anatomy").
	// Pure markup so it is SSR-testable; FindingPopover supplies the bits-ui dialog around it.
	import OctagonAlert from '@lucide/svelte/icons/octagon-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { STATE_SCOPE_NOTE, type Finding, type FindingMember } from '@tran/core/fair-housing';
	import { Button } from '$lib/components/ui/button/index.js';
	import { groupCopyFor, type CheckGroupCopy } from './post-check';

	let {
		finding,
		headingId,
		checkGroups = [],
		onApply,
		onEdit
	}: {
		finding: Finding;
		headingId: string;
		/** Phase 7: members of a group with allowRemovePhrase false get no automatic fix. */
		checkGroups?: readonly CheckGroupCopy[];
		onApply?: () => void;
		onEdit?: () => void;
	} = $props();

	const isBlock = $derived(finding.severity === 'block');
	const first = $derived(finding.members[0]);
	// The primary action follows the first Must fix member (else the first member).
	const primary = $derived(finding.members.find((m) => m.severity === 'block') ?? first);
	const removes = $derived(primary?.alternative === '');
	/** A member with no alternative whose group forbids "Remove phrase" offers no suggestion. */
	const noFix = (m: FindingMember) =>
		m.alternative === '' && groupCopyFor(m, checkGroups)?.allowRemovePhrase === false;
	// No automatic action: "Edit it myself" becomes the primary (and the popover's focus target).
	const canApply = $derived(!primary || !noFix(primary));
</script>

<div class="flex flex-col gap-2">
	<div id={headingId} class="flex flex-col gap-1">
		<p
			class="flex items-center gap-1 text-label font-semibold {isBlock
				? 'text-destructive'
				: 'text-foreground'}"
		>
			{#if isBlock}
				<OctagonAlert size={16} aria-hidden="true" class="shrink-0" />
				Must fix
			{:else}
				<TriangleAlert size={16} aria-hidden="true" class="shrink-0" />
				Review
			{/if}
		</p>
		{#if first}
			<p class="text-body font-semibold text-foreground">Category: {first.categoryLabel}</p>
		{/if}
	</div>

	{#each finding.members as member, i (`${member.checker}:${member.entryId}:${i}`)}
		<div class="flex flex-col gap-2 {i > 0 ? 'border-t border-border pt-2' : ''}">
			{#if i > 0}
				<p class="text-body font-semibold text-foreground">Category: {member.categoryLabel}</p>
			{/if}
			{#if member.scope === 'state'}
				<p class="text-label text-muted-foreground">{STATE_SCOPE_NOTE}</p>
			{/if}
			<p class="text-body text-foreground">{member.explanation}</p>
			{#if member.alternative}
				<p class="text-body text-foreground">
					<span class="font-semibold">Suggested wording:</span>
					“{member.alternative}”
				</p>
			{:else if !noFix(member)}
				<p class="text-body text-foreground">Suggested fix: remove this phrase.</p>
			{/if}
			{#if member.source !== ''}
				<p class="text-label text-muted-foreground">Based on: {member.source}</p>
			{/if}
		</div>
	{/each}

	<div class="flex flex-wrap gap-2 pt-2">
		{#if canApply}
			<Button data-finding-apply="" onclick={() => onApply?.()}>
				{removes ? 'Remove phrase' : 'Use alternative'}
			</Button>
			<Button variant="outline" onclick={() => onEdit?.()}>Edit it myself</Button>
		{:else}
			<Button data-finding-apply="" onclick={() => onEdit?.()}>Edit it myself</Button>
		{/if}
	</div>
</div>
