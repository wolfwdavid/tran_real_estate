<script lang="ts">
	// /agent/today/ (AGT-05): the full due-today queue. Prerendered with the heading and the loading
	// line; the browser-stored tasks render after hydration.
	import TodayQueue from '$lib/features/agent/tasks/TodayQueue.svelte';
</script>

<svelte:head>
	<title>Today: Agent portal &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Every follow-up task that is overdue or due today, in one queue, stored only in this browser."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	<h1 class="font-display text-display font-semibold">Today</h1>
	<div class="mt-4 max-w-[640px]">
		<TodayQueue variant="full" />
	</div>
</div>
