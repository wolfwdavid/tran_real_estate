<script lang="ts">
	// Tasks on the contact detail page (UI-SPEC "Contact detail > Tasks"; AGT-05): the open tasks
	// as TaskRows with a ghost Delete each (undoable through the UndoStatus line), the Add a task
	// form, and the done tasks under a closed <details>. Focus after any change waits for the live
	// task list to reflect the write (the 08-19 / 08-21 pattern), then lands on the new or
	// restored task's checkbox, the next open task after a completion, the status line after a
	// delete, or the Tasks heading when nothing else is there.
	import { tick } from 'svelte';
	import type { Contact, Task } from '@tran/core/agent/types';
	import { firstName } from '@tran/core/leads/normalize';
	import { announce } from '$lib/features/shared/data/platform-ui';
	import { deleteTask, restoreTask } from '$lib/storage/agent/tasks-repo';
	import AddTaskForm from '../tasks/AddTaskForm.svelte';
	import TaskRow from '../tasks/TaskRow.svelte';
	import { nextFocusTarget } from '../tasks/task-ui';
	import UndoStatus from '../ui/UndoStatus.svelte';

	let {
		contact,
		tasks,
		today
	}: {
		contact: Contact;
		/** This contact's live tasks, open and done. */
		tasks: readonly Task[];
		today: string;
	} = $props();

	const TASKS_UNDO_ID = 'tasks-undo';
	const open = $derived(tasks.filter((t) => t.status === 'open'));
	const done = $derived(tasks.filter((t) => t.status === 'done'));

	interface FocusRequest {
		ready: (tasks: readonly Task[]) => boolean;
		target: () => HTMLElement | null;
		fallback: () => HTMLElement | null;
	}

	let status = $state<string | null>(null);
	let undoId = $state<string | null>(null);
	let pending = $state<FocusRequest | null>(null);
	let h2El = $state<HTMLHeadingElement | null>(null);
	let busy = false;

	const checkbox = (id: string): HTMLElement | null =>
		document.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(id)}"] [data-task-checkbox]`);
	const statusLine = (): HTMLElement | null => document.getElementById(TASKS_UNDO_ID);
	const heading = (): HTMLElement | null => h2El;

	// Settle the pending focus once the live list reflects the change.
	$effect(() => {
		const p = pending;
		if (!p || !p.ready(tasks)) return;
		pending = null;
		void tick().then(() => (p.target() ?? p.fallback())?.focus());
	});

	async function remove(t: Task) {
		if (busy) return;
		busy = true;
		try {
			await deleteTask(t.id);
			status = `Deleted task "${t.title}".`;
			undoId = t.id;
			announce(`Deleted task ${t.title}.`);
			pending = {
				ready: (list) => !list.some((x) => x.id === t.id),
				target: statusLine,
				fallback: heading
			};
		} finally {
			busy = false;
		}
	}

	async function undo() {
		const id = undoId;
		if (!id || busy) return;
		busy = true;
		try {
			await restoreTask(id);
			undoId = null;
			status = 'Task restored.';
			announce('Task restored.');
			pending = {
				ready: (list) => list.some((x) => x.id === id),
				target: () => checkbox(id),
				fallback: statusLine
			};
		} finally {
			busy = false;
		}
	}

	function onadded(t: Task) {
		pending = {
			ready: (list) => list.some((x) => x.id === t.id),
			target: () => checkbox(t.id),
			fallback: heading
		};
	}

	function ondone(t: Task) {
		const next = nextFocusTarget(
			open.map((x) => x.id),
			t.id
		);
		pending = {
			ready: (list) => list.some((x) => x.id === t.id && x.status === 'done'),
			target: () => (next ? checkbox(next) : null),
			fallback: heading
		};
	}

	function onreopened(t: Task) {
		pending = {
			ready: (list) => list.some((x) => x.id === t.id && x.status === 'open'),
			target: () => checkbox(t.id),
			fallback: heading
		};
	}
</script>

<section aria-labelledby="tasks-title" class="flex flex-col gap-6" data-contact-tasks>
	<h2
		id="tasks-title"
		bind:this={h2El}
		tabindex="-1"
		class="font-display text-heading font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	>
		Tasks
	</h2>

	<UndoStatus id={TASKS_UNDO_ID} message={status} onundo={undoId ? undo : undefined} />

	{#if open.length > 0}
		<ul class="flex flex-col gap-4" aria-label="Open tasks" data-open-tasks>
			{#each open as t (t.id)}
				<TaskRow task={t} {contact} {today} ondelete={() => remove(t)} {ondone} />
			{/each}
		</ul>
	{:else}
		<p class="text-body text-muted-foreground" data-tasks-empty>
			No open tasks. Add one so {firstName(contact.name)} shows up in Today when it's due.
		</p>
	{/if}

	<div class="flex flex-col gap-4">
		<h3 class="text-base leading-[1.6] font-semibold text-foreground">Add a task</h3>
		<AddTaskForm {contact} {today} {onadded} />
	</div>

	{#if done.length > 0}
		<details class="rounded-lg border border-border bg-card p-4" data-done-tasks>
			<summary
				class="flex min-h-11 cursor-pointer items-center text-base leading-[1.6] font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				Done ({done.length})
			</summary>
			<ul class="mt-4 flex flex-col gap-4" aria-label="Done tasks">
				{#each done as t (t.id)}
					<TaskRow task={t} {contact} {today} {onreopened} />
				{/each}
			</ul>
		</details>
	{/if}
</section>
