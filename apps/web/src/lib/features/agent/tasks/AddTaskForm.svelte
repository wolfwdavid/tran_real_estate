<script lang="ts">
	// Add a follow-up task to one contact (UI-SPEC "Contact detail > Tasks"; mounted by the contact
	// page in plan 08-23). Task title + Due date (defaults to today) with quick-set buttons that only
	// change the date. Validation copy comes from addTask's TaskValidationError; on success the
	// title clears, the add is announced and the parent moves focus to the new task's checkbox.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { tick } from 'svelte';
	import { MAX_TASK_TITLE } from '@tran/core/agent/schemas';
	import type { Contact, Task } from '@tran/core/agent/types';
	import { quickDates } from '@tran/core/crm';
	import { Button, Input, Label, announce } from '$lib/features/shared/data/platform-ui';
	import { TaskValidationError, addTask } from '$lib/storage/agent/tasks-repo';
	import { formatMonDay } from '../dates';
	import DateField from '../ui/DateField.svelte';
	import { taskErrorMessage } from './task-ui';

	let {
		contact,
		today,
		onadded
	}: {
		contact: Contact;
		today: string;
		/** After the task was saved and announced (the parent focuses its checkbox). */
		onadded?: (task: Task) => void;
	} = $props();

	const uid = $props.id();
	const ids = {
		title: `${uid}-title`,
		titleError: `${uid}-title-error`,
		due: `${uid}-due`,
		dueError: `${uid}-due-error`
	};

	let title = $state('');
	// The due date starts at today and is then owned by the field and the quick-set buttons.
	// svelte-ignore state_referenced_locally
	let due = $state(today);
	let titleError = $state<string | null>(null);
	let dueError = $state<string | null>(null);
	let pending = $state(false);
	let titleEl = $state<HTMLInputElement | null>(null);

	const quick = $derived.by(() => {
		const q = quickDates(today);
		return [
			{ label: 'Today', value: q.today },
			{ label: 'Tomorrow', value: q.tomorrow },
			{ label: 'In 3 days', value: q.in3Days },
			{ label: 'Next week', value: q.nextWeek }
		];
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (pending) return;
		titleError = null;
		dueError = null;
		pending = true;
		try {
			const t = await addTask(contact.id, title, due);
			title = '';
			announce(`Task added for ${contact.name}, due ${formatMonDay(t.dueDate)}.`);
			onadded?.(t);
		} catch (err) {
			if (!(err instanceof TaskValidationError)) throw err;
			if (err.code === 'due-invalid') {
				dueError = taskErrorMessage(err.code);
				await tick();
				document.getElementById(ids.due)?.focus();
			} else {
				titleError = taskErrorMessage(err.code);
				await tick();
				titleEl?.focus();
			}
		} finally {
			pending = false;
		}
	}
</script>

<form class="grid gap-4" novalidate onsubmit={submit}>
	<div class="grid gap-2">
		<Label for={ids.title}>Task</Label>
		<Input
			id={ids.title}
			bind:ref={titleEl}
			bind:value={title}
			type="text"
			required
			maxlength={MAX_TASK_TITLE}
			autocomplete="off"
			class="h-12"
			aria-invalid={titleError ? 'true' : undefined}
			aria-describedby={titleError ? ids.titleError : undefined}
			oninput={() => (titleError = null)}
		/>
		{#if titleError}
			<p id={ids.titleError} class="flex items-center gap-1 text-label text-destructive">
				<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
				{titleError}
			</p>
		{/if}
	</div>
	<div class="grid gap-2">
		<DateField
			id={ids.due}
			label="Due"
			bind:value={due}
			required
			invalid={dueError !== null}
			describedby={dueError ? ids.dueError : undefined}
		/>
		{#if dueError}
			<p id={ids.dueError} class="flex items-center gap-1 text-label text-destructive">
				<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
				{dueError}
			</p>
		{/if}
		<div class="flex flex-wrap gap-2">
			{#each quick as q (q.label)}
				<Button
					type="button"
					variant="ghost"
					class="min-h-11"
					aria-pressed={due === q.value}
					onclick={() => {
						due = q.value;
						dueError = null;
					}}>{q.label}</Button
				>
			{/each}
		</div>
	</div>
	<div>
		<Button type="submit" class="min-h-11" disabled={pending}>
			{pending ? 'Adding…' : 'Add task'}
		</Button>
	</div>
</form>
