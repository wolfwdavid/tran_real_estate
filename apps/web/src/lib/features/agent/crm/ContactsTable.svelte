<script lang="ts">
	// UI-SPEC "Contacts list" table (1024px and up): Name (link + Sample data chip), Stage, Next
	// task, Last contact, Added. Lives inside the Phase 3 scroll wrapper (a focusable, labelled
	// region) so a narrow container scrolls the table instead of the page. The name link carries
	// the same id ContactCard uses, so a parent can move focus to a contact either way.
	import { resolve } from '$app/paths';
	import type { Contact, Task } from '@tran/core/agent';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import StageBadge from '../ui/StageBadge.svelte';
	import DueBadge from './DueBadge.svelte';
	import { formatMonDay, localDateOf, relativeDays } from '../dates';

	let {
		rows,
		caption,
		today,
		nextTask
	}: {
		rows: readonly Contact[];
		/** "{n} contacts": the table caption and the scroll region's label. */
		caption: string;
		today: string;
		nextTask: (contact: Contact) => Task | null;
	} = $props();

	const href = (c: Contact) => resolve('/agent/contact/') + '?id=' + encodeURIComponent(c.id);
	const th = 'py-2 pr-4 text-left font-semibold whitespace-nowrap';
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="relative overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	tabindex="0"
	role="region"
	aria-label={caption}
>
	<table class="w-full min-w-[48rem] border-collapse text-base leading-[1.6]" data-contacts-table>
		<caption class="mb-2 text-left text-label text-muted-foreground">{caption}</caption>
		<thead>
			<tr class="border-b border-border">
				<th scope="col" class={th}>Name</th>
				<th scope="col" class={th}>Stage</th>
				<th scope="col" class={th}>Next task</th>
				<th scope="col" class={th}>Last contact</th>
				<th scope="col" class="py-2 text-left font-semibold whitespace-nowrap">Added</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as c (c.id)}
				{@const task = nextTask(c)}
				<tr class="border-b border-border align-top last:border-b-0" data-contact-id={c.id}>
					<td class="py-3 pr-4">
						<span class="inline-flex flex-wrap items-center gap-2">
							<!-- eslint-disable svelte/no-navigation-without-resolve -- href is built from resolve() plus ?id= -->
							<a
								id="contact-{c.id}-name"
								href={href(c)}
								class="font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								>{c.name}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{#if c.sample}<SampleChip />{/if}
						</span>
					</td>
					<td class="py-3 pr-4"><StageBadge stage={c.stage} /></td>
					<td class="py-3 pr-4">
						{#if task}
							<DueBadge {task} {today} />
						{:else}
							<span class="text-muted-foreground">None</span>
						{/if}
					</td>
					<td class="py-3 pr-4 whitespace-nowrap tabular-nums">
						{#if c.lastContactedAt}
							{relativeDays(c.lastContactedAt)}
						{:else}
							<span class="text-muted-foreground">Never</span>
						{/if}
					</td>
					<td class="py-3 whitespace-nowrap tabular-nums"
						>{formatMonDay(localDateOf(c.createdAt))}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
