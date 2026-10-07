<script lang="ts">
	// /agent/contacts/. Prerendered with the heading, the Add a lead action and the loading line;
	// the browser-stored data decides what renders after hydration: the CRM empty state when there
	// are no live contacts, otherwise the list (built by plan 08-18; the loading line stands in for
	// it until then). After a quick add, focus moves to the page h1.
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import CrmEmptyState from '$lib/features/agent/crm/CrmEmptyState.svelte';
	import QuickAddDialog from '$lib/features/agent/crm/QuickAddDialog.svelte';
	import { Button } from '$lib/features/shared/data/platform-ui';
	import { useContacts } from '$lib/storage/agent/live.svelte';

	const contacts = useContacts();
	const isEmpty = $derived(contacts.loaded && contacts.current.length === 0);

	let addOpen = $state(false);
	let h1El = $state<HTMLHeadingElement | null>(null);
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
		<Button variant="outline" class="min-h-11" onclick={() => (addOpen = true)}>
			<UserPlus size={16} aria-hidden="true" />
			Add a lead
		</Button>
	</div>

	{#if isEmpty}
		<CrmEmptyState onaddlead={() => (addOpen = true)} />
	{:else}
		<p class="mt-4 text-label text-muted-foreground">Loading your contacts&hellip;</p>
	{/if}

	<QuickAddDialog bind:open={addOpen} onadded={() => h1El?.focus()} />
</div>
