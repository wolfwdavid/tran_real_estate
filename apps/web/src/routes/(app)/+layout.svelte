<script lang="ts">
	import { page } from '$app/state';
	import SiteHeader from '$lib/components/layout/SiteHeader.svelte';
	import SiteFooter from '$lib/components/layout/SiteFooter.svelte';
	import AppNotice from '$lib/features/shared/app-notice/AppNotice.svelte';
	import DataShell from '$lib/features/shared/data/DataShell.svelte';

	let { children } = $props();

	// /settings/ shows the full meter in its own section, so the status bar is hidden there.
	// Matched by route id (as PortalSwitcher does), not by comparing page.url.pathname with
	// resolve('/settings/'): with relative paths, resolve() is relative during prerender, so the
	// path comparison would render the bar into the prerendered Settings shell.
	const showStatusBar = $derived(page.route.id !== '/(app)/settings');
</script>

<SiteHeader showSettings={true} />
<main id="main-content" tabindex="-1">
	<!-- DataShell renders the Data source status bar as the first child of <main>; AppNotice is the
	     second (04-UI-SPEC Planner Note 2). -->
	<DataShell {showStatusBar}>
		<AppNotice />
		{@render children()}
	</DataShell>
</main>
<SiteFooter />
