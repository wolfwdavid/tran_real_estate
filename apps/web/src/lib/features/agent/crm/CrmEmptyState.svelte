<script lang="ts">
	// UI-SPEC "Empty state heading (CRM)": shown when the CRM holds no live contacts. The three ways
	// in: add one lead by hand, import a list, or load the keyless sample contacts (offered here and
	// nowhere else). Loading writes the in-repo fixture to this browser's IndexedDB; no network.
	import Users from '@lucide/svelte/icons/users';
	import { resolve } from '$app/paths';
	import { Button, buttonVariants, announce } from '$lib/features/shared/data/platform-ui';
	import EmptyState from '../ui/EmptyState.svelte';
	import { SAMPLE_COUNT, loadSampleContacts } from '../samples/samples';

	let { onaddlead }: { onaddlead: () => void } = $props();

	let loading = $state(false);

	async function load() {
		if (loading) return;
		loading = true;
		try {
			await loadSampleContacts();
			announce(`Loaded ${SAMPLE_COUNT} sample contacts.`);
		} finally {
			loading = false;
		}
	}
</script>

<EmptyState
	icon={Users}
	title="No contacts yet"
	body="Add your first lead, import a list, or load sample contacts to see how the pipeline works. Everything stays in this browser."
>
	<Button class="min-h-11" onclick={onaddlead}>Add a lead</Button>
	<a href={resolve('/agent/import/')} class={buttonVariants({ variant: 'outline' })}>Import leads</a
	>
	<Button variant="outline" class="min-h-11" disabled={loading} onclick={load}>
		{loading ? 'Loading…' : 'Load sample contacts'}
	</Button>
</EmptyState>
