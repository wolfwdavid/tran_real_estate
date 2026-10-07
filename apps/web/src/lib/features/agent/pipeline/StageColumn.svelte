<script lang="ts">
	// UI-SPEC "StageBoard" structure: one stage section (a surface well, min-height 160px) with an
	// h2 that reads "{Stage}, {n} contacts", the visible count ("{n}" or "{shown} of {total}" under
	// a filter), and the cards as a keyed list, each with its Move menu. The section is a native
	// drop target only while dragEnabled (1280px+, fine pointer); the Move menu is always there.
	// Moves re-render instantly: no motion on drop, menu move or Undo (UI-SPEC "Shape, Elevation,
	// Motion").
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import { STAGE_LABELS, type Contact, type Stage, type Task } from '@tran/core/agent/types';
	import ContactCard from '../crm/ContactCard.svelte';
	import { DRAG_MIME, readDraggedId } from './dnd';
	import MoveMenu from './MoveMenu.svelte';

	let {
		stage,
		cards,
		total,
		filtered,
		today,
		nextTaskOf,
		knownIds,
		dragEnabled,
		draggingId,
		dropTarget,
		activeTarget,
		onmove,
		ondragstart,
		ondragend,
		onenter,
		onleave,
		ondrop
	}: {
		stage: Stage;
		/** The cards to show, already filtered and sorted. */
		cards: Contact[];
		/** Live contacts in this stage before the smart-list filter. */
		total: number;
		filtered: boolean;
		today: string;
		nextTaskOf: (contactId: string) => Task | null;
		/** Every live contact id; a drop carrying anything else is ignored. */
		knownIds: ReadonlySet<string>;
		dragEnabled: boolean;
		draggingId: string | null;
		/** A drag is in progress and this column is a valid target (not the source column). */
		dropTarget: boolean;
		/** The pointer is over this column during a drag. */
		activeTarget: boolean;
		onmove: (contact: Contact, to: Stage) => void;
		ondragstart: (contactId: string) => void;
		ondragend: () => void;
		onenter: () => void;
		onleave: () => void;
		ondrop: (contactId: string) => void;
	} = $props();

	const label = $derived(STAGE_LABELS[stage]);
	const titleId = $derived(`stage-${stage}-title`);
	const countText = $derived(filtered ? `${cards.length} of ${total}` : String(total));
	const nounText = $derived(total === 1 ? 'contact' : 'contacts');

	// dragenter/dragleave fire for every child the pointer crosses; a depth counter turns them into
	// one enter and one leave per column.
	let depth = 0;

	$effect(() => {
		if (!dropTarget) depth = 0;
	});

	function enter(e: DragEvent) {
		if (!dropTarget) return;
		e.preventDefault();
		depth += 1;
		if (depth === 1) onenter();
	}

	function leave() {
		if (!dropTarget) return;
		depth = Math.max(0, depth - 1);
		if (depth === 0) onleave();
	}

	function over(e: DragEvent) {
		if (!dropTarget) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function drop(e: DragEvent) {
		if (!dropTarget) return;
		e.preventDefault();
		depth = 0;
		const id = readDraggedId(e.dataTransfer, knownIds);
		onleave();
		if (id) ondrop(id);
	}

	function start(e: DragEvent, contact: Contact) {
		if (!dragEnabled || !e.dataTransfer) return;
		// setData is what makes Firefox start the drag at all; the id is all a drop needs.
		e.dataTransfer.setData(DRAG_MIME, contact.id);
		e.dataTransfer.effectAllowed = 'move';
		ondragstart(contact.id);
	}

	function end() {
		depth = 0;
		ondragend();
	}
</script>

<!-- Drag handlers on a non-interactive element: the Move menu on every card is the accessible
     equivalent (WCAG 2.5.7). Svelte 5 emits no a11y warning for drag events here (verified with
     svelte-check and eslint valid-compile), so no svelte-ignore is needed, and an unused one
     fails svelte/no-unused-svelte-ignore. -->
<section
	id="stage-{stage}"
	aria-labelledby={titleId}
	data-stage={stage}
	class={[
		'flex min-h-40 min-w-0 flex-col rounded-lg bg-surface p-4',
		dropTarget && !activeTarget && 'outline-2 outline-border-strong outline-dashed',
		activeTarget && 'outline-2 outline-primary outline-solid'
	]}
	ondragenter={enter}
	ondragleave={leave}
	ondragover={over}
	ondrop={drop}
>
	<div class="flex items-baseline justify-between gap-2">
		<h2 id={titleId} class="text-base leading-[1.6] font-semibold text-foreground">
			{label}<span class="sr-only">, {countText} {nounText}</span>
		</h2>
		<span
			data-stage-count
			aria-hidden="true"
			class="text-label font-semibold text-muted-foreground tabular-nums">{countText}</span
		>
	</div>

	{#if cards.length === 0}
		<p class="mt-3 text-label text-muted-foreground">No contacts in {label}.</p>
	{:else}
		<ul class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-1">
			{#each cards as contact (contact.id)}
				<!-- draggable card: the Move menu below is the accessible equivalent (WCAG 2.5.7) -->
				<li
					class={[
						'relative min-w-0',
						dragEnabled && 'cursor-grab active:cursor-grabbing [&>article]:pr-10',
						draggingId === contact.id &&
							'[&>article]:border-2 [&>article]:border-dashed [&>article]:border-border-strong [&>article]:bg-surface'
					]}
					draggable={dragEnabled ? true : undefined}
					ondragstart={(e) => start(e, contact)}
					ondragend={end}
				>
					{#if dragEnabled}
						<GripVertical
							size={16}
							class="pointer-events-none absolute top-4 right-4 text-muted-foreground"
							aria-hidden="true"
						/>
					{/if}
					<ContactCard
						{contact}
						nextTask={nextTaskOf(contact.id)}
						{today}
						variant="board"
						moving={draggingId === contact.id}
					>
						{#snippet actions()}
							<MoveMenu {contact} onmove={(to) => onmove(contact, to)} />
						{/snippet}
					</ContactCard>
				</li>
			{/each}
		</ul>
	{/if}

	{#if activeTarget}
		<p class="mt-auto pt-3 text-label font-semibold text-foreground">Drop to move to {label}</p>
	{/if}
</section>
