<script lang="ts">
	import '@fontsource-variable/fraunces';
	import '@fontsource-variable/inter';
	import '../app.css';
	import { afterNavigate } from '$app/navigation';
	import SkipLink from '$lib/components/layout/SkipLink.svelte';
	import LiveAnnouncer from '$lib/components/a11y/LiveAnnouncer.svelte';

	let { children } = $props();

	// First-party usage beacon (GTM-04). The gate reads the build-time defines directly (the same
	// values lib/site.ts exports as ANALYTICS) so the bundler can drop this whole block and its
	// dynamic import from a build without an analytics host: the default build ships and fetches
	// nothing extra on any route. With a host, the tracker is one lazy chunk (lib/analytics/boot,
	// which does not import $lib/site) that no route preloads; it is fetched after hydration, on
	// the first afterNavigate, and holds the referrer / width logic so this block stays tiny (tool
	// pages sit close to the 60 KB gz budget). The tracker checks GPC / Do Not Track before every send.
	if (__ANALYTICS_HOST__ && __ANALYTICS_WEBSITE_ID__) {
		afterNavigate(({ to }) => {
			if (to) import('$lib/analytics/boot').then((m) => m.pageview(to.url)).catch(() => {});
		});
	}
</script>

<SkipLink />
{@render children()}
<LiveAnnouncer />
