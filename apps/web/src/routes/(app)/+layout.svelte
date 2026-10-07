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
	// The agent portal hides it too (08-UI-SPEC Planner Note 4): the agent CRM spends no RentCast
	// calls, so a meter or a "Sample data" bar would mislabel the agent's own contacts. In the Studio
	// (09-UI-SPEC Planner Note 2) only /agent/studio/snapshot/ spends RentCast calls, so the bar
	// shows there and nowhere else: the hub, listing, social and reel work from the agent's facts.
	// The agent CRM also skips the check-on-open saved-search run (08-27, SC5: zero RentCast calls
	// with a real key present). A session opened on an agent page runs it on the first non-agent
	// route; settings and every /agent/studio/ route keep it. isAgentCrm is the single predicate for
	// the alerts gate; the status bar additionally narrows the Studio to its snapshot route.
	const isAgentStudio = (id: string | null) =>
		id !== null && (id === '/(app)/agent/studio' || id.startsWith('/(app)/agent/studio/'));
	const isAgentCrm = (id: string | null) =>
		id !== null && (id === '/(app)/agent' || id.startsWith('/(app)/agent/')) && !isAgentStudio(id);
	const showStatusBar = $derived(
		page.route.id !== '/(app)/settings' &&
			!isAgentCrm(page.route.id) &&
			(!isAgentStudio(page.route.id) || page.route.id === '/(app)/agent/studio/snapshot')
	);
	const runAlerts = $derived(!isAgentCrm(page.route.id));
</script>

<SiteHeader showSettings={true} />
<main id="main-content" tabindex="-1">
	<!-- DataShell renders the Data source status bar as the first child of <main>; AppNotice is the
	     second (04-UI-SPEC Planner Note 2). -->
	<DataShell {showStatusBar} {runAlerts}>
		<AppNotice />
		{@render children()}
	</DataShell>
</main>
<SiteFooter />
