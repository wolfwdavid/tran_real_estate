<script lang="ts">
	// /agent/, the portal entry (AGT-05): the h1 stays "Agent portal" (Phase 2 checks); the body is
	// the AgentHome with the due-today queue first. Prerendered with the loading line; the
	// browser-stored data decides what renders after hydration. After a quick add, focus moves to
	// the h1 (the home has no contact list to land on).
	import AgentHome from '$lib/features/agent/home/AgentHome.svelte';

	let h1El = $state<HTMLHeadingElement | null>(null);
</script>

<svelte:head>
	<title>Agent portal: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Your follow-ups due today, your pipeline counts, and quick ways to add leads. Stored only in this browser."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	<h1
		bind:this={h1El}
		tabindex="-1"
		class="font-display text-display font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	>
		Agent portal
	</h1>
	<AgentHome onadded={() => h1El?.focus()} />
</div>
