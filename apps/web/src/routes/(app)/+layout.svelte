<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { browser } from '$app/environment';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { consumeSampleParam } from '$lib/components/onboarding/setup-params';
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
	// /setup/rentcast/ (10-16) hides it too: its "Add a RentCast key" link would point away from the
	// page that does exactly that.
	const HIDE_STATUS_BAR: ReadonlySet<string | null> = new Set([
		'/(app)/settings',
		'/(app)/setup/rentcast'
	]);
	const showStatusBar = $derived(
		!HIDE_STATUS_BAR.has(page.route.id) &&
			!isAgentCrm(page.route.id) &&
			(!isAgentStudio(page.route.id) || page.route.id === '/(app)/agent/studio/snapshot')
	);
	const runAlerts = $derived(!isAgentCrm(page.route.id));

	// Sample mode hand-off (10-UI-SPEC "Sample mode hand-off", Planner Note 7): arriving with
	// ?source=sample (the guide's and audience pages' "Try sample data", the setup page's "Use
	// sample data for now") switches the data source to sample, strips the parameter without a
	// navigation, and announces it. On /agent/ an empty CRM also gets the sample contacts.
	// The parameter is read from the arrival URL, synchronously: pages may rewrite their own query
	// in onMount (the renter search does), long before the runtime is ready. The runtime lives in
	// DataShell's context, below this layout, so DataShell hands it over through onStart and holds
	// its check-on-open pass until the first hand-off is done, so nothing is spent in live mode.
	type Runtime = Parameters<NonNullable<ComponentProps<typeof DataShell>['onStart']>>[0];
	let resolveRuntime: (rt: Runtime) => void = () => undefined;
	const runtimeReady = new Promise<Runtime>((r) => (resolveRuntime = r));

	async function handOffSample(): Promise<void> {
		const rt = await runtimeReady;
		await rt.setSourcePreference('sample');
		if (page.route.id === '/(app)/agent') {
			const crm = await import('$lib/features/agent/samples/samples');
			if (!(await crm.hasAnyContacts())) await crm.loadSampleContacts();
		}
		// The current URL, which a page may have changed meanwhile, minus ?source.
		const { sample, cleaned } = consumeSampleParam(new URL(location.href));
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current URL minus ?source
		if (sample) replaceState(cleaned, page.state);
		announce('Showing sample data.');
	}

	// First arrival: read during init (browser only; the prerender has no query).
	let firstHandOff: Promise<void> = Promise.resolve();
	if (browser && consumeSampleParam(page.url).sample) {
		firstHandOff = handOffSample().catch(() => undefined);
	}

	function onStart(rt: Runtime): Promise<void> {
		resolveRuntime(rt);
		return firstHandOff;
	}

	// Later in-app arrivals (this layout stays mounted), e.g. the setup page's sample link.
	afterNavigate((nav) => {
		if (nav.type === 'enter' || !nav.to || !consumeSampleParam(nav.to.url).sample) return;
		handOffSample().catch(() => undefined);
	});
</script>

<svelte:head>
	<!-- Not a marketing page: kept out of search results and the sitemap (10-UI-SPEC robots rule). -->
	<meta name="robots" content="noindex" />
</svelte:head>

<SiteHeader showSettings={true} />
<main id="main-content" tabindex="-1">
	<!-- DataShell renders the Data source status bar as the first child of <main>; AppNotice is the
	     second (04-UI-SPEC Planner Note 2). -->
	<DataShell {showStatusBar} {runAlerts} {onStart}>
		<AppNotice />
		{@render children()}
	</DataShell>
</main>
<SiteFooter />
