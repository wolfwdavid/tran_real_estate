<script lang="ts">
	// bits-ui popover anchored to one finding trigger. Enter/Space opens, focus moves to the primary
	// action (Use alternative / Remove phrase), Escape closes and bits-ui returns focus to the trigger.
	import type { Snippet } from 'svelte';
	import type { Finding } from '@tran/core/fair-housing';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import FindingDetails from './FindingDetails.svelte';
	import type { CheckGroupCopy } from './post-check';

	let {
		finding,
		idPrefix,
		checkGroups = [],
		open = $bindable(false),
		onApply,
		onEdit,
		trigger
	}: {
		finding: Finding;
		idPrefix: string;
		checkGroups?: readonly CheckGroupCopy[];
		open?: boolean;
		onApply?: (findingId: string) => void;
		onEdit?: (findingId: string) => void;
		trigger: Snippet<[props: Record<string, unknown>]>;
	} = $props();

	const base = $derived(`${idPrefix}-finding-${finding.id}`);
	const headingId = $derived(`${base}-heading`);
	const contentId = $derived(`${base}-popover`);
	let contentRef = $state<HTMLElement | null>(null);

	function focusPrimary(e: Event) {
		e.preventDefault();
		contentRef?.querySelector<HTMLElement>('[data-finding-apply]')?.focus();
	}

	function apply() {
		open = false;
		onApply?.(finding.id);
	}

	function edit() {
		open = false;
		onEdit?.(finding.id);
	}
</script>

<!-- Tags hug (no whitespace text nodes) so the trigger sits inline inside its <mark>. -->
<Popover.Root bind:open
	><Popover.Trigger
		>{#snippet child({ props })}
			<!-- bits-ui only sets aria-controls while open; the contract keeps it on the trigger. -->
			{@render trigger({ ...props, 'aria-controls': contentId })}
		{/snippet}</Popover.Trigger
	><Popover.Content
		bind:ref={contentRef}
		id={contentId}
		role="dialog"
		aria-labelledby={headingId}
		onOpenAutoFocus={focusPrimary}
	>
		<FindingDetails {finding} {headingId} {checkGroups} onApply={apply} onEdit={edit} />
	</Popover.Content></Popover.Root
>
