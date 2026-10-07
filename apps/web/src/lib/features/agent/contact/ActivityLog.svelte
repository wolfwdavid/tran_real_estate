<script lang="ts">
	// Activity on the contact detail page (UI-SPEC "Contact detail > Activity"): the Log contact
	// mini-form first (Type, optional Details, Log it -> logContact, which moves lastContactedAt
	// for calls, emails, meetings and other contact), then the newest-first list, 20 at a time.
	// Entries are the auto strings the repo writes (added, moves, task done, details updated,
	// opt-out, inquiry, follow-up marked as sent) plus what the agent logs here.
	import type { Component } from 'svelte';
	import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left';
	import Circle from '@lucide/svelte/icons/circle';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Mail from '@lucide/svelte/icons/mail';
	import MailCheck from '@lucide/svelte/icons/mail-check';
	import MailX from '@lucide/svelte/icons/mail-x';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Phone from '@lucide/svelte/icons/phone';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import UserPen from '@lucide/svelte/icons/user-pen';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Users from '@lucide/svelte/icons/users';
	import type { Activity, ActivityType, Contact } from '@tran/core/agent/types';
	import { Button, Input, Label, announce } from '$lib/features/shared/data/platform-ui';
	import { logContact, type LogType } from '$lib/storage/agent/contacts-repo';
	import { formatActivityTime } from '../dates';
	import NativeSelect from '../ui/NativeSelect.svelte';
	import { LOG_TYPES, logAnnouncement } from './contact-ui';

	let {
		contact,
		activities
	}: {
		contact: Contact;
		/** This contact's live activities, newest first. */
		activities: readonly Activity[];
	} = $props();

	/** Entries shown before the first Show older activity. */
	const PAGE = 20;
	const MAX_DETAILS = 200;

	type Icon = Component<{ size?: number; class?: string; 'aria-hidden'?: 'true' }>;
	const ICONS: Readonly<Record<ActivityType, Icon>> = {
		added: UserPlus,
		stage_changed: ArrowRightLeft,
		task_done: CircleCheck,
		draft_sent: MailCheck,
		details_updated: UserPen,
		opt_out_set: MailX,
		opt_out_cleared: Mail,
		inquiry: Inbox,
		call: Phone,
		email: Mail,
		meeting: Users,
		other: MessageSquare,
		note: StickyNote
	};
	const iconFor = (type: ActivityType): Icon => ICONS[type] ?? Circle;

	const uid = $props.id();
	const ids = { form: `${uid}-log`, type: `${uid}-type`, details: `${uid}-details` };

	let type = $state<string>('call');
	let details = $state('');
	let pending = $state(false);
	let limit = $state(PAGE);

	const shown = $derived(activities.slice(0, limit));

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (pending) return;
		pending = true;
		try {
			const t = type as LogType;
			await logContact(contact.id, t, details);
			details = '';
			announce(logAnnouncement(t, contact.name));
		} finally {
			pending = false;
		}
	}
</script>

<section aria-labelledby="activity-title" class="flex flex-col gap-6" data-contact-activity>
	<h2 id="activity-title" class="font-display text-heading font-semibold text-foreground">
		Activity
	</h2>

	<form class="grid gap-4" novalidate onsubmit={submit} aria-labelledby={ids.form}>
		<h3 id={ids.form} class="text-base leading-[1.6] font-semibold text-foreground">Log contact</h3>
		<NativeSelect id={ids.type} label="Type" bind:value={type} options={LOG_TYPES} />
		<div class="grid gap-2">
			<Label for={ids.details}>Details (optional)</Label>
			<Input
				id={ids.details}
				bind:value={details}
				type="text"
				maxlength={MAX_DETAILS}
				autocomplete="off"
				class="h-12"
			/>
		</div>
		<div>
			<Button type="submit" variant="outline" class="min-h-11" disabled={pending}>Log it</Button>
		</div>
	</form>

	{#if activities.length === 0}
		<p class="text-body text-muted-foreground" data-activity-empty>
			No activity yet. Moves, finished tasks, and emails you mark as sent show up here.
		</p>
	{:else}
		<ol reversed start={activities.length} class="flex flex-col gap-4" data-activity-list>
			{#each shown as a (a.id)}
				{@const Icon = iconFor(a.type)}
				<li class="flex items-start gap-3" data-activity-type={a.type}>
					<Icon size={16} class="mt-1 shrink-0 text-secondary" aria-hidden="true" />
					<div class="flex min-w-0 flex-col gap-1">
						<p class="text-body wrap-anywhere text-foreground">{a.text}</p>
						<time datetime={a.at} class="text-label text-muted-foreground tabular-nums"
							>{formatActivityTime(a.at)}</time
						>
					</div>
				</li>
			{/each}
		</ol>
		{#if activities.length > shown.length}
			<Button variant="ghost" class="min-h-11 self-start" onclick={() => (limit += PAGE)}>
				Show older activity
			</Button>
		{/if}
	{/if}
</section>
