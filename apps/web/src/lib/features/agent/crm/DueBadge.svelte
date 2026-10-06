<script lang="ts">
	// UI-SPEC "DueBadge": overdue and due-today are badges with an icon and words (never colour
	// alone); upcoming is muted text; a done task or no task renders nothing.
	import CalendarX2 from '@lucide/svelte/icons/calendar-x-2';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import type { Task } from '@tran/core/agent';
	import { isDueToday, isOverdue } from '@tran/core/crm';
	import { formatMonDay } from '../dates';

	let { task, today }: { task: Task | null; today: string } = $props();

	const kind = $derived.by(() => {
		if (!task || task.status !== 'open' || task.deletedAt !== undefined) return null;
		if (isOverdue(task, today)) return 'overdue';
		if (isDueToday(task, today)) return 'today';
		return 'upcoming';
	});
</script>

{#if task && kind === 'overdue'}
	<span
		data-due="overdue"
		class="inline-flex items-center gap-1 rounded-full bg-accent-surface px-2 py-1 text-label font-semibold whitespace-nowrap text-foreground"
	>
		<CalendarX2 class="size-3.5" aria-hidden="true" />
		Overdue · {formatMonDay(task.dueDate)}
	</span>
{:else if kind === 'today'}
	<span
		data-due="today"
		class="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-label font-semibold whitespace-nowrap text-foreground"
	>
		<CalendarClock class="size-3.5" aria-hidden="true" />
		Due today
	</span>
{:else if task && kind === 'upcoming'}
	<span data-due="upcoming" class="text-label whitespace-nowrap text-muted-foreground">
		Due {formatMonDay(task.dueDate)}
	</span>
{/if}
