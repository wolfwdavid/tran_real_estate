<script lang="ts">
	// /agent/contacts/. Prerendered with the heading and the loading line; the browser-stored data
	// decides what renders after hydration: the CRM empty state when there are no live contacts,
	// otherwise the contacts list (search, smart lists, paging, CSV export). The header's Add a
	// lead stands in while the list (which carries its own) is not shown. After a quick add, focus
	// moves to the new contact's link when it is visible under the current filter, else to the h1.
	import { tick } from 'svelte';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import type { Contact } from '@tran/core/agent';
	import ContactsView from '$lib/features/agent/crm/ContactsView.svelte';
	import CrmEmptyState from '$lib/features/agent/crm/CrmEmptyState.svelte';
	import QuickAddDialog from '$lib/features/agent/crm/QuickAddDialog.svelte';
	import { Button } from '$lib/features/shared/data/platform-ui';
	import { useContacts } from '$lib/storage/agent/live.svelte';

	const contacts = useContacts();
	const isEmpty = $derived(contacts.loaded && contacts.current.length === 0);
	const hasContacts = $derived(contacts.loaded && contacts.current.length > 0);

	let addOpen = $state(false);
	let h1El = $state<HTMLHeadingElement | null>(null);
	let view = $state<ContactsView | null>(null);
	let pendingFocusId = $state<string | null>(null);

	// The live query delivers the new contact a moment after the dialog closes; focus follows it.
	$effect(() => {
		const id = pendingFocusId;
		if (id === null || !contacts.current.some((c) => c.id === id)) return;
		pendingFocusId = null;
		void focusAdded(id);
	});

	async function focusAdded(id: string) {
		await tick();
		if (!(await view?.focusContact(id))) h1El?.focus();
	}

	function onadded(c: Contact) {
		pendingFocusId = c.id;
	}
</script>

<svelte:head>
	<title>Contacts: Agent portal &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Search your contacts, filter them with smart lists, and export them as a CSV file. Stored only in this browser."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<h1
			bind:this={h1El}
			tabindex="-1"
			class="font-display text-display font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			Contacts
		</h1>
		{#if !hasContacts}
			<Button variant="outline" class="min-h-11" onclick={() => (addOpen = true)}>
				<UserPlus size={16} aria-hidden="true" />
				Add a lead
			</Button>
		{/if}
	</div>

	{#if isEmpty}
		<CrmEmptyState onaddlead={() => (addOpen = true)} />
	{:else if hasContacts}
		<ContactsView bind:this={view} contacts={contacts.current} onaddlead={() => (addOpen = true)} />
	{:else}
		<p class="mt-4 text-label text-muted-foreground">Loading your contacts&hellip;</p>
	{/if}

	<QuickAddDialog bind:open={addOpen} {onadded} />
</div>
