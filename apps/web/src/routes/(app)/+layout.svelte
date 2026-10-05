<script lang="ts">
	import SiteHeader from '$lib/components/layout/SiteHeader.svelte';
	import SiteFooter from '$lib/components/layout/SiteFooter.svelte';
	import AppNotice from '$lib/features/shared/app-notice/AppNotice.svelte';

	let { children } = $props();
</script>

<SiteHeader showSettings={true} />
<main id="main-content" tabindex="-1">
	<!-- Phase 4 inserts DataStatusBar before AppNotice (04-UI-SPEC). -->
	<AppNotice />
	{@render children()}
</main>
<SiteFooter />
