<script lang="ts">
	// The due-today queue (AGT-05; UI-SPEC "TodayQueue"). Full variant on /agent/today/: date line,
	// Overdue / Due today / Coming up sections and a closed Done today <details>. Compact variant on
	// /agent/: the first five of overdue then due today with a "See everything due" link. Grouping
	// is @tran/core groupTasks over the live open tasks (plus today's done tasks in the full
	// variant); dates are local calendar dates. After a task is checked, focus moves to the next
	// task in its group, else the group heading (UI-SPEC "Focus management").
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Task } from '@tran/core/agent/types';
	import { groupTasks } from '@tran/core/crm';
	import { useContacts } from '$lib/storage/agent/live.svelte';
	import { useDoneToday, useOpenTasks } from '$lib/storage/agent/tasks-live.svelte';
	import { formatWeekdayLong, localDateOf, parseLocalDate, todayLocal } from '../dates';
	import TaskRow from './TaskRow.svelte';
	import { compactQueue, nextFocusTarget, taskCountLabel } from './task-ui';

	let { variant }: { variant: 'full' | 'compact' } = $props();

	type GroupKey = 'overdue' | 'due-today' | 'coming-up' | 'done-today';

	const uid = $props.id();
	const today = todayLocal();
	const open = useOpenTasks();
	const doneToday = useDoneToday(parseLocalDate(today).toISOString());
	const contacts = useContacts();
	const full = $derived(variant === 'full');

	const byId = $derived(new Map(contacts.current.map((c) => [c.id, c])));
	const loaded = $derived(open.loaded && contacts.loaded && (!full || doneToday.loaded));
	const groups = $derived.by(() => {
		const source = full ? [...open.current, ...doneToday.current] : open.current;
		return groupTasks(
			source.filter((t) => byId.has(t.contactId)),
			{ today, localDate: localDateOf, contactName: (id) => byId.get(id)?.name ?? '' }
		);
	});
	const compact = $derived(compactQueue(groups));
	const dueNow = $derived(groups.overdue.length + groups.dueToday.length);

	interface Group {
		key: GroupKey;
		title: string;
		tasks: Task[];
	}
	const dueGroups = $derived<Group[]>([
		{ key: 'overdue', title: 'Overdue', tasks: groups.overdue },
		{ key: 'due-today', title: 'Due today', tasks: groups.dueToday }
	]);
	const compactGroups = $derived<Group[]>([
		{ key: 'overdue', title: 'Overdue', tasks: compact.overdue },
		{ key: 'due-today', title: 'Due today', tasks: compact.dueToday }
	]);

	// Focus after a change: wait for the live query to reflect it, then find the target in the DOM.
	let root = $state<HTMLElement | null>(null);
	let focusAfter = $state<{
		taskId: string;
		expectOpen: boolean;
		targetId: string | null;
		group: GroupKey;
	} | null>(null);

	const afterDone = (group: GroupKey, ids: string[], t: Task) => {
		focusAfter = {
			taskId: t.id,
			expectOpen: false,
			targetId: nextFocusTarget(ids, t.id),
			group
		};
	};
	const afterReopen = (t: Task) => {
		focusAfter = { taskId: t.id, expectOpen: true, targetId: t.id, group: 'done-today' };
	};

	$effect(() => {
		const f = focusAfter;
		if (!f) return;
		const isOpen = open.current.some((t) => t.id === f.taskId);
		if (isOpen !== f.expectOpen) return;
		void tick().then(() => {
			if (focusAfter !== f || !root) return;
			focusAfter = null;
			const el =
				(f.targetId &&
					root.querySelector<HTMLElement>(`[data-task-id="${f.targetId}"] [data-task-checkbox]`)) ||
				root.querySelector<HTMLElement>(`[data-group="${f.group}"] [data-group-heading]`) ||
				root.querySelector<HTMLElement>('[data-queue-empty-focus]');
			el?.focus();
		});
	});

	const ids = (ts: Task[]) => ts.map((t) => t.id);
	const headingClass =
		'font-display text-heading font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
	const pipelineHref = resolve('/agent/pipeline/');
	const todayHref = resolve('/agent/today/');
</script>

{#snippet rows(group: GroupKey, tasks: Task[])}
	<ul class="mt-4 flex flex-col gap-2">
		{#each tasks as t (t.id)}
			{@const contact = byId.get(t.contactId)}
			{#if contact}
				<TaskRow
					task={t}
					{contact}
					{today}
					showContact
					ondone={(task) => afterDone(group, ids(tasks), task)}
					onreopened={afterReopen}
				/>
			{/if}
		{/each}
	</ul>
{/snippet}

<div bind:this={root} data-today-queue={variant}>
	{#if !loaded}
		<p class="text-label text-muted-foreground">Loading your tasks&hellip;</p>
	{:else if full}
		<p class="text-label text-muted-foreground">{formatWeekdayLong(today)}</p>

		{#if dueNow === 0}
			<div data-queue-empty class="mt-8 flex items-start gap-3 rounded-lg bg-secondary-surface p-4">
				<CircleCheck size={20} class="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
				<div class="flex flex-col gap-2">
					<h2 id="{uid}-empty" tabindex="-1" data-queue-empty-focus class={headingClass}>
						Nothing due today
					</h2>
					<p class="text-body text-foreground">
						You're caught up. Add a task from any contact to plan your next follow-up.
					</p>
					<a
						href={pipelineHref}
						class="inline-flex min-h-11 items-center self-start font-semibold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>Open your pipeline</a
					>
				</div>
			</div>
		{:else}
			{#each dueGroups as g (g.key)}
				<section aria-labelledby="{uid}-{g.key}" data-group={g.key} class="mt-8">
					<div class="flex flex-wrap items-baseline gap-x-3">
						<h2 id="{uid}-{g.key}" tabindex="-1" data-group-heading class={headingClass}>
							{g.title}
						</h2>
						<span class="text-label text-muted-foreground">{taskCountLabel(g.tasks.length)}</span>
					</div>
					{#if g.tasks.length > 0}
						{@render rows(g.key, g.tasks)}
					{/if}
				</section>
			{/each}
		{/if}

		{#if groups.comingUp.length > 0}
			<section aria-labelledby="{uid}-coming-up" data-group="coming-up" class="mt-8">
				<div class="flex flex-wrap items-baseline gap-x-3">
					<h2 id="{uid}-coming-up" tabindex="-1" data-group-heading class={headingClass}>
						Coming up
					</h2>
					<span class="text-label text-muted-foreground"
						>{taskCountLabel(groups.comingUp.length + groups.comingUpMore)}</span
					>
				</div>
				{@render rows('coming-up', groups.comingUp)}
				{#if groups.comingUpMore > 0}
					<p class="mt-2 text-label text-muted-foreground">and {groups.comingUpMore} more</p>
				{/if}
			</section>
		{/if}

		{#if groups.doneToday.length > 0}
			<details data-group="done-today" class="mt-8">
				<summary
					data-group-heading
					class="flex list-item min-h-11 cursor-pointer items-center text-body font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>Done today ({groups.doneToday.length})</summary
				>
				{@render rows('done-today', groups.doneToday)}
			</details>
		{/if}
	{:else if dueNow === 0}
		<p
			data-queue-empty
			data-queue-empty-focus
			tabindex="-1"
			class="mt-4 text-body text-muted-foreground"
		>
			Nothing due today. You're caught up. Add a task from any contact to plan your next follow-up.
		</p>
	{:else}
		{#each compactGroups as g (g.key)}
			{#if g.tasks.length > 0}
				<div data-group={g.key} class="mt-4">
					<h3
						tabindex="-1"
						data-group-heading
						class="text-body font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>
						{g.title}
					</h3>
					{@render rows(g.key, g.tasks)}
				</div>
			{/if}
		{/each}
		{#if compact.more > 0}
			<a
				href={todayHref}
				class="mt-4 inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>See everything due</a
			>
		{/if}
	{/if}
</div>
