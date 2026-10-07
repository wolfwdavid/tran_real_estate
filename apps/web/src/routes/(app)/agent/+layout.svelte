<script lang="ts">
	// The agent portal layout (08-UI-SPEC "(app) agent layout"): AgentNav, then the Sample contacts
	// notice (or, right after a removal, its Undo line), then the page. It sits inside the (app)
	// layout's <main>, after the AppNotice slot; the Data source status bar is hidden on /agent/*
	// because the agent CRM spends no RentCast calls. The Today count pill reads the live open tasks
	// (overdue or due today, local date).
	import { afterNavigate } from '$app/navigation';
	import SampleContactsNotice from '$lib/features/agent/crm/SampleContactsNotice.svelte';
	import { todayLocal } from '$lib/features/agent/dates';
	import { restoreSampleContacts } from '$lib/features/agent/samples/samples';
	import {
		clearSamplesState,
		samplesState
	} from '$lib/features/agent/samples/samples-state.svelte';
	import { dueCount } from '$lib/features/agent/tasks/task-ui';
	import AgentNav from '$lib/features/agent/ui/AgentNav.svelte';
	import UndoStatus from '$lib/features/agent/ui/UndoStatus.svelte';
	import { announce } from '$lib/features/shared/data/platform-ui';
	import { useOpenTasks } from '$lib/storage/agent/tasks-live.svelte';

	let { children } = $props();

	const tasks = useOpenTasks();
	const due = $derived(dueCount(tasks.current ?? [], todayLocal()));

	// An Undo never outlives the page it was offered on.
	afterNavigate(() => clearSamplesState());

	let restoring = false;

	async function undoRemove() {
		const snapshot = samplesState.undo;
		if (!snapshot || restoring) return;
		restoring = true;
		try {
			// samplesState is deep $state, so `snapshot` is a Proxy; IndexedDB's structured clone
			// refuses proxies (DataCloneError). Hand Dexie plain objects.
			await restoreSampleContacts($state.snapshot(snapshot));
			clearSamplesState();
			announce('Sample contacts restored.');
		} finally {
			restoring = false;
		}
	}
</script>

<div class="mx-auto max-w-page px-6 pt-6 md:px-8">
	<AgentNav dueCount={due} />
	<div class="mt-6 empty:hidden">
		{#if samplesState.status !== null}
			<UndoStatus message={samplesState.status} onundo={undoRemove} />
		{:else}
			<SampleContactsNotice />
		{/if}
	</div>
</div>
<div class="mt-8">
	{@render children()}
</div>
