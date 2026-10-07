<script lang="ts">
	// One follow-up task (UI-SPEC "TodayQueue" task row), shared by Today, the home queue and the
	// contact detail. The checkbox's label is the task title; checking marks the task done at once
	// (completeTask logs "Task done: {title}" in the same transaction) and unchecking reopens it.
	// The parent owns focus after a change through ondone / onreopened.
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { resolve } from '$app/paths';
	import type { Contact, Task } from '@tran/core/agent/types';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Button, announce } from '$lib/features/shared/data/platform-ui';
	import { completeTask, reopenTask } from '$lib/storage/agent/tasks-repo';
	import DueBadge from '../crm/DueBadge.svelte';
	import StageBadge from '../ui/StageBadge.svelte';

	let {
		task,
		contact,
		today,
		showContact = false,
		ondelete,
		ondone,
		onreopened
	}: {
		task: Task;
		contact: Contact;
		today: string;
		showContact?: boolean;
		ondelete?: () => void;
		/** After the task was marked done and announced. */
		ondone?: (task: Task) => void;
		/** After the task was reopened and announced. */
		onreopened?: (task: Task) => void;
	} = $props();

	const uid = $props.id();
	const checkboxId = `${uid}-check`;
	const labelId = `${uid}-label`;
	const done = $derived(task.status === 'done');
	let pending = $state(false);

	const contactHref = $derived(
		resolve('/agent/contact/') + '?id=' + encodeURIComponent(contact.id)
	);

	async function toggle(checked: boolean) {
		if (pending || checked === done) return;
		pending = true;
		try {
			if (checked) {
				await completeTask(task.id);
				announce(`Done: ${task.title}.`);
				ondone?.(task);
			} else {
				await reopenTask(task.id);
				announce(`Reopened: ${task.title}.`);
				onreopened?.(task);
			}
		} finally {
			pending = false;
		}
	}
</script>

<li data-task-id={task.id} class="rounded-md border border-border bg-card p-4">
	<div class="flex items-start gap-3">
		<div class="flex min-h-11 items-center">
			<Checkbox
				id={checkboxId}
				data-task-checkbox
				aria-labelledby={labelId}
				checked={done}
				disabled={pending}
				onCheckedChange={toggle}
			/>
		</div>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<div class="flex min-h-11 flex-wrap items-center gap-x-2">
				<label
					id={labelId}
					for={checkboxId}
					class="cursor-pointer text-body text-foreground {done ? 'line-through' : ''}"
					>{task.title}</label
				>
				{#if done}<span class="text-label text-muted-foreground">Done</span>{/if}
			</div>
			{#if showContact}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- href is built from resolve() plus ?id= -->
				<a
					href={contactHref}
					class="self-start text-body font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>{contact.name}</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
			<div class="flex flex-wrap items-center gap-1">
				<DueBadge {task} {today} />
				<StageBadge stage={contact.stage} />
				{#if contact.sample}<SampleChip />{/if}
			</div>
		</div>
		{#if ondelete}
			<Button variant="ghost" class="min-h-11 shrink-0" onclick={ondelete}>
				<Trash2 size={16} aria-hidden="true" />
				Delete
			</Button>
		{/if}
	</div>
</li>
