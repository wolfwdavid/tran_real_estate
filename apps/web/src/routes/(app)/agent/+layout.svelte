<script lang="ts">
	// The agent portal layout (08-UI-SPEC "(app) agent layout"): AgentNav, then the page. It sits
	// inside the (app) layout's <main>, after the AppNotice slot; the Data source status bar is
	// hidden on /agent/* because the agent CRM spends no RentCast calls. The live Today count is
	// wired by a later plan, and SampleContactsNotice goes between the nav and the page.
	import AgentNav from '$lib/features/agent/ui/AgentNav.svelte';

	let { children } = $props();
</script>

<div class="mx-auto max-w-page px-6 pt-6 md:px-8">
	<AgentNav />
</div>
<div class="mt-8">
	{@render children()}
</div>
