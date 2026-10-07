<script lang="ts">
	// /agent/pipeline/ (AGT-04). Prerendered with the heading and the loading line; after
	// hydration the browser-stored data decides: the CRM empty state when there are no live
	// contacts, otherwise the StageBoard once the open tasks have loaded too. One QuickAddDialog serves Add a lead (board header and
	// empty state); after an add, focus goes to the new card's link, or to the h1 when the active
	// filter hides it. A #stage-{stage} hash scrolls that section into view once the board renders.
	import { tick } from 'svelte';
	import { STAGES, type Contact } from '@tran/core/agent/types';
	import CrmEmptyState from '$lib/features/agent/crm/CrmEmptyState.svelte';
	import QuickAddDialog from '$lib/features/agent/crm/QuickAddDialog.svelte';
	import { createBoardState } from '$lib/features/agent/pipeline/board-state.svelte';
	import StageBoard from '$lib/features/agent/pipeline/StageBoard.svelte';
	import { useContacts } from '$lib/storage/agent/live.svelte';
	import { useOpenTasks } from '$lib/storage/agent/tasks-live.svelte';

	const contacts = useContacts();
	const tasks = useOpenTasks();
	const isEmpty = $derived(contacts.loaded && contacts.current.length === 0);
	// The board's card order, due badges and filter counts come from the open tasks, a separate
	// live query. Rendering on contacts alone showed the cards in recency order and re-sorted them
	// a moment later, moving a card out from under a press. Wait for both (a failed task query
	// still shows the board, as before, just without task data).
	const tasksSettled = $derived(tasks.loaded || tasks.error !== undefined);
	const boardReady = $derived(contacts.loaded && !isEmpty && tasksSettled);
	const board = createBoardState();

	let addOpen = $state(false);
	let h1El = $state<HTMLHeadingElement | null>(null);

	// Deep link (#stage-touring): scroll once, after the board has rendered.
	let hashHandled = false;
	$effect(() => {
		if (hashHandled || !boardReady) return;
		hashHandled = true;
		const m = /^#stage-([a-z]+)$/.exec(location.hash);
		if (!m || !(STAGES as readonly string[]).includes(m[1])) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		void tick().then(() => {
			document
				.getElementById(`stage-${m[1]}`)
				?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' });
		});
	});

	function afterAdd(c: Contact) {
		board.requestFocus({
			ready: (list) => list.some((x) => x.id === c.id),
			target: () => document.getElementById(`contact-${c.id}-name`),
			fallback: () => h1El
		});
	}
</script>

<svelte:head>
	<title>Pipeline: Agent portal &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Your leads by stage, from new to closed, on a board you can rearrange. Stored only in this browser."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	<h1
		bind:this={h1El}
		tabindex="-1"
		class="font-display text-display font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	>
		Pipeline
	</h1>

	{#if isEmpty}
		<CrmEmptyState onaddlead={() => (addOpen = true)} />
	{:else if !boardReady}
		<p class="mt-4 text-label text-muted-foreground">Loading your contacts&hellip;</p>
	{:else}
		<StageBoard
			contacts={contacts.current}
			tasks={tasks.current}
			{board}
			onaddlead={() => (addOpen = true)}
		/>
	{/if}

	<QuickAddDialog bind:open={addOpen} onadded={afterAdd} />
</div>
