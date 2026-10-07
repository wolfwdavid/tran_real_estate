<script lang="ts">
	// UI-SPEC "Sample contacts" notice: the agent layout renders it between AgentNav and the page,
	// and it shows itself only while any live contact is a sample. Remove deletes just the sample
	// records and hands the snapshot to samples-state, where the layout offers Undo; no confirm
	// dialog, because the action is undoable and the data is reloadable.
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import { Button, announce } from '$lib/features/shared/data/platform-ui';
	import { useContacts } from '$lib/storage/agent/live.svelte';
	import { removeSampleContacts } from '../samples/samples';
	import { samplesState } from '../samples/samples-state.svelte';

	const contacts = useContacts();
	const hasSamples = $derived(contacts.current.some((c) => c.sample === true));

	let removing = $state(false);

	async function remove() {
		if (removing) return;
		removing = true;
		try {
			const snapshot = await removeSampleContacts();
			const status = `Removed ${snapshot.contacts.length} sample contacts.`;
			samplesState.undo = snapshot;
			samplesState.status = status;
			announce(status);
		} finally {
			removing = false;
		}
	}
</script>

{#if hasSamples}
	<div
		role="region"
		aria-label="Sample contacts"
		class="flex flex-col gap-4 rounded-lg border border-border-strong bg-accent-surface p-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<p class="flex items-start gap-2 text-base leading-[1.6] text-foreground">
			<FlaskConical size={20} class="mt-1 shrink-0" aria-hidden="true" />
			<span>
				Sample contacts are mixed in with yours. They're made up, and each one is marked Sample
				data.
			</span>
		</p>
		<Button variant="outline" class="min-h-11 shrink-0" disabled={removing} onclick={remove}>
			Remove sample contacts
		</Button>
	</div>
{/if}
