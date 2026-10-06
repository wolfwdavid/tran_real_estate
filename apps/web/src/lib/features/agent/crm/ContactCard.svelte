<script lang="ts">
	// UI-SPEC "ContactCard": shared by the board (with the Move action row) and the mobile lists.
	// Flat card: no shadow at rest and no hover lift, because it holds controls.
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import MailX from '@lucide/svelte/icons/mail-x';
	import { SOURCE_LABELS, type Contact, type Task } from '@tran/core/agent';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import DueBadge from './DueBadge.svelte';
	import { relativeDays } from '../dates';

	let {
		contact,
		nextTask,
		today,
		variant,
		moving = false,
		actions
	}: {
		contact: Contact;
		nextTask: Task | null;
		today: string;
		variant: 'board' | 'list';
		moving?: boolean;
		actions?: Snippet;
	} = $props();

	const nameId = $derived(`contact-${contact.id}-name`);
	const href = $derived(resolve('/agent/contact/') + '?id=' + encodeURIComponent(contact.id));
	const meta = $derived.by(() => {
		if (moving) return 'Moving…';
		const last = contact.lastContactedAt
			? `Last contact ${relativeDays(contact.lastContactedAt)}`
			: 'Not contacted yet';
		return variant === 'list' ? `${last} · ${SOURCE_LABELS[contact.source]}` : last;
	});
</script>

<article
	aria-labelledby={nameId}
	data-contact-id={contact.id}
	class="flex flex-col gap-1 rounded-lg border border-border bg-card p-4"
>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- href is built from resolve() plus ?id= -->
	<a
		id={nameId}
		{href}
		class="line-clamp-2 text-base leading-[1.6] font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>{contact.name}</a
	>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	<p class="text-label text-muted-foreground">{meta}</p>
	{#if (nextTask && nextTask.status === 'open') || contact.sample || contact.emailOptOutAt}
		<div class="flex flex-wrap items-center gap-1">
			<DueBadge task={nextTask} {today} />
			{#if contact.sample}<SampleChip />{/if}
			{#if contact.emailOptOutAt}
				<span
					data-no-emails
					class="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-label font-semibold whitespace-nowrap text-muted-foreground"
				>
					<MailX class="size-3.5" aria-hidden="true" />
					No emails
				</span>
			{/if}
		</div>
	{/if}
	{#if actions}
		<div class="mt-1 flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</article>
