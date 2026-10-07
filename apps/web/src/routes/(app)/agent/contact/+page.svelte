<script lang="ts">
	// /agent/contact/?id= (AGT-04, AGT-05). Prerendered with a generic heading and the loading
	// line; the record id travels as ?id= and is read from location.search after every navigation
	// (no [param] routes, and an "Open {First}" link from the duplicate alert lands on this same
	// route with another id). The live views are recreated whenever the id changes. Unknown or
	// deleted ids show the not-found block with focus on its h1. While a delete is in flight the
	// page keeps the contact on screen until the redirect to Contacts.
	//
	// Layout: one column below 1024px in the order header, contact info, tasks, notes, follow-up,
	// activity; two columns (main 640px, aside 352px) from 1024px. The wrappers are display:
	// contents below the breakpoint so the mobile order is set with `order` on a flat flex column.
	import { tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Contact } from '@tran/core/agent/types';
	import ActivityLog from '$lib/features/agent/contact/ActivityLog.svelte';
	import ContactHeader from '$lib/features/agent/contact/ContactHeader.svelte';
	import ContactInfo from '$lib/features/agent/contact/ContactInfo.svelte';
	import ContactNotes from '$lib/features/agent/contact/ContactNotes.svelte';
	import ContactTasks from '$lib/features/agent/contact/ContactTasks.svelte';
	import { todayLocal } from '$lib/features/agent/dates';
	import { createBoardState } from '$lib/features/agent/pipeline/board-state.svelte';
	import { buttonVariants } from '$lib/features/shared/data/platform-ui';
	import { useActivities, useContact } from '$lib/storage/agent/live.svelte';
	import { useTasksFor } from '$lib/storage/agent/tasks-live.svelte';

	/** undefined until the first navigation settles; null when the URL carries no id. */
	let id = $state<string | null | undefined>(undefined);
	/** The contact being deleted, kept on screen until the redirect. */
	let leaving = $state<Contact | null>(null);
	let editing = $state(false);
	let notFoundEl = $state<HTMLHeadingElement | null>(null);

	const board = createBoardState();
	const today = todayLocal();

	afterNavigate(() => {
		id = new URLSearchParams(location.search).get('id') || null;
		leaving = null;
		editing = false;
		board.clear();
	});

	const contact = $derived(id ? useContact(id) : null);
	const activities = $derived(id ? useActivities(id) : null);
	const tasks = $derived(id ? useTasksFor(id) : null);
	const c = $derived(leaving ?? contact?.current ?? null);
	const notFound = $derived(id === null || (contact !== null && contact.loaded && c === null));
	const title = $derived(c ? `${c.name}: Agent portal` : 'Contact: Agent portal');

	// UI-SPEC "Focus management": an unknown id focuses the not-found h1.
	$effect(() => {
		if (!notFound) return;
		void tick().then(() => notFoundEl?.focus());
	});

	// Undo from the header's status line focuses that line once the live record reflects it.
	$effect(() => {
		if (c) void board.settle([c]);
	});

	async function closeEdit() {
		editing = false;
		await tick();
		document.querySelector<HTMLElement>('[data-edit-details]')?.focus();
	}
</script>

<svelte:head>
	<title>{title} &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="One contact's details, tasks, notes, activity, and follow-up email drafts, stored only in this browser."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	{#if notFound}
		<h1
			bind:this={notFoundEl}
			tabindex="-1"
			class="font-display text-display font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			This contact isn't here
		</h1>
		<p class="mt-4 max-w-prose text-body text-foreground">
			It may have been deleted, or the link is from another browser. Contacts live only in the
			browser where you added them.
		</p>
		<a href={resolve('/agent/contacts/')} class={buttonVariants({ class: 'mt-6 min-h-11' })}
			>Go to contacts</a
		>
	{:else if c}
		<div
			class="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,640px)_352px] lg:items-start lg:gap-8"
			data-contact-page
		>
			<div class="contents lg:flex lg:flex-col lg:gap-12">
				<div class="order-1">
					<ContactHeader
						contact={c}
						taskCount={tasks?.current.length ?? 0}
						{board}
						onedit={() => (editing = true)}
						onleaving={(contact) => (leaving = contact)}
					/>
				</div>
				<div class="order-3">
					<ContactTasks contact={c} tasks={tasks?.current ?? []} {today} />
				</div>
				<div class="order-4">
					<ContactNotes contact={c} />
				</div>
				<section id="follow-up" aria-labelledby="follow-up-title" class="order-5">
					<!-- Plan 08-25 renders the FollowUpComposer under this heading. -->
					<h2 id="follow-up-title" class="font-display text-heading font-semibold text-foreground">
						Follow-up email
					</h2>
				</section>
			</div>
			<div class="contents lg:flex lg:flex-col lg:gap-12">
				<div class="order-2">
					<ContactInfo contact={c} {editing} onclose={closeEdit} />
				</div>
				<div class="order-6">
					<ActivityLog contact={c} activities={activities?.current ?? []} />
				</div>
			</div>
		</div>
	{:else}
		<h1 class="font-display text-display font-semibold">Contact</h1>
		<p class="mt-4 text-label text-muted-foreground">Loading this contact&hellip;</p>
	{/if}
</div>
