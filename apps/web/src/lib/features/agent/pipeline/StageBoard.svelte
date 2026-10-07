<script lang="ts">
	// UI-SPEC "Pipeline: StageBoard" (AGT-04): the Show filter and Add a lead row, the UndoStatus
	// line, a "Jump to" row (stacked view only), and the five stage sections in fixed order. Side
	// by side from 1280px, stacked below. Every move (Move menu, pointer drop, Undo) goes through
	// the one board-state path. Native drag is offered only when DRAG_MEDIA matches; the Move
	// menu on every card is the keyboard and touch path (WCAG 2.5.7). ?list= mirrors the filter.
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		isLive,
		STAGE_LABELS,
		STAGES,
		type Contact,
		type Stage,
		type Task
	} from '@tran/core/agent/types';
	import {
		countLists,
		matchesList,
		nextOpenTask,
		SMART_LIST_LABELS,
		sortForBoard,
		stageCounts,
		type ListCtx,
		type SmartList
	} from '@tran/core/crm';
	import { announce, Button } from '$lib/features/shared/data/platform-ui';
	import { readListParam, withParams } from '../crm/list-state';
	import SmartListFilter from '../crm/SmartListFilter.svelte';
	import { localDateOf, todayLocal } from '../dates';
	import UndoStatus from '../ui/UndoStatus.svelte';
	import { BOARD_UNDO_ID, type BoardState } from './board-state.svelte';
	import { DRAG_MEDIA } from './dnd';
	import StageColumn from './StageColumn.svelte';

	let {
		contacts,
		tasks,
		board,
		onaddlead
	}: {
		/** Live contacts view (tombstones are dropped here). */
		contacts: readonly Contact[];
		/** Open tasks (the Today queue view); drives due badges, sort and the Due today list. */
		tasks: readonly Task[];
		board: BoardState;
		onaddlead: () => void;
	} = $props();

	const today = todayLocal();

	const live = $derived(contacts.filter(isLive));

	// Derived indexes are built from entries (never mutated after creation): plain Map is right
	// here, and eslint's prefer-svelte-reactivity only objects to mutation.
	const openByContact = $derived.by(() => {
		const open = tasks.filter((t) => isLive(t) && t.status === 'open');
		const ids = [...new Set(open.map((t) => t.contactId))];
		return new Map<string, Task[]>(
			ids.map((id) => [id, open.filter((t) => t.contactId === id)] as const)
		);
	});

	const ctx = $derived<ListCtx>({
		today,
		localDate: localDateOf,
		openTasksByContact: openByContact
	});

	const nextTaskById = $derived(
		new Map<string, Task | null>(
			[...openByContact].map(([id, list]) => [id, nextOpenTask(list)] as const)
		)
	);

	const nextDue = $derived(
		new Map<string, string>(
			[...nextTaskById].flatMap(([id, t]) => (t ? [[id, t.dueDate] as const] : []))
		)
	);

	const counts = $derived(countLists(live, ctx));
	const totals = $derived(stageCounts(live));
	const knownIds = $derived(new Set(live.map((c) => c.id)));

	// --- Smart-list filter, mirrored into ?list= ------------------------------------------------
	let list = $state<SmartList>('all');
	const filtered = $derived(list !== 'all');

	const columns = $derived(
		STAGES.map((stage) => ({
			stage,
			cards: sortForBoard(
				live.filter((c) => c.stage === stage && matchesList(list, c, ctx)),
				nextDue
			)
		}))
	);

	onMount(() => {
		list = readListParam(location.search);
	});

	function changeList(next: SmartList) {
		const href = `${resolve('/agent/pipeline/')}${withParams(location.search, { list: next })}`;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- href is resolve() plus this page's own ?list=
		replaceState(href, page.state);
		const n = counts[next] ?? 0;
		announce(`Showing ${SMART_LIST_LABELS[next]}: ${n} ${n === 1 ? 'contact' : 'contacts'}.`);
	}

	// --- Native drag (progressive enhancement) --------------------------------------------------
	const drag = new MediaQuery(DRAG_MEDIA, false);
	const dragEnabled = $derived(drag.current);
	let draggingId = $state<string | null>(null);
	let activeStage = $state<Stage | null>(null);
	const sourceStage = $derived(
		draggingId === null ? null : (live.find((c) => c.id === draggingId)?.stage ?? null)
	);

	function endDrag() {
		draggingId = null;
		activeStage = null;
	}

	function drop(id: string, to: Stage) {
		const contact = live.find((c) => c.id === id);
		endDrag();
		if (contact) void board.move(contact, to, { focus: false });
	}

	// Focus after a move, Undo or quick add lands once the live list reflects the write.
	$effect(() => {
		void board.settle(contacts);
	});
</script>

<div class="mt-6 flex flex-col gap-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<SmartListFilter bind:value={list} {counts} onchange={changeList} />
		<Button variant="outline" class="min-h-11" onclick={onaddlead}>
			<UserPlus size={16} aria-hidden="true" />
			Add a lead
		</Button>
	</div>

	<UndoStatus
		id={BOARD_UNDO_ID}
		message={board.status}
		onundo={board.undo ? board.undoLast : undefined}
	/>

	<nav aria-label="Jump to" class="flex flex-wrap items-center gap-2 xl:hidden">
		<span class="text-label font-semibold text-muted-foreground">Jump to</span>
		{#each STAGES as stage (stage)}
			<a
				href="#stage-{stage}"
				class="inline-flex min-h-11 items-center gap-1 rounded-md border border-border-strong px-3 text-base leading-[1.6] text-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				{STAGE_LABELS[stage]} <span class="tabular-nums">{totals[stage]}</span>
			</a>
		{/each}
	</nav>

	<div class="grid gap-6 xl:grid-cols-5 xl:items-start xl:gap-4" data-stage-board>
		{#each columns as col (col.stage)}
			<StageColumn
				stage={col.stage}
				cards={col.cards}
				total={totals[col.stage]}
				{filtered}
				{today}
				nextTaskOf={(id) => nextTaskById.get(id) ?? null}
				{knownIds}
				{dragEnabled}
				{draggingId}
				dropTarget={draggingId !== null && sourceStage !== col.stage}
				activeTarget={activeStage === col.stage}
				onmove={(contact, to) => void board.move(contact, to, { focus: true })}
				ondragstart={(id) => (draggingId = id)}
				ondragend={endDrag}
				onenter={() => (activeStage = col.stage)}
				onleave={() => {
					if (activeStage === col.stage) activeStage = null;
				}}
				ondrop={(id) => drop(id, col.stage)}
			/>
		{/each}
	</div>
</div>
