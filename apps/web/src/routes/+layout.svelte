<script lang="ts">
	import '@fontsource-variable/fraunces';
	import '@fontsource-variable/inter';
	import '../app.css';
	import { afterNavigate } from '$app/navigation';
	import SkipLink from '$lib/components/layout/SkipLink.svelte';
	import LiveAnnouncer from '$lib/components/a11y/LiveAnnouncer.svelte';

	let { children } = $props();

	// First-party usage beacon (GTM-04). The gate reads the build-time defines directly (the same
	// values lib/site.ts exports as ANALYTICS) so the bundler can drop this whole block, the dynamic
	// imports and their preload helper from a build without an analytics host: the default build
	// ships and fetches nothing extra on any route. site.ts is imported lazily too, so the layout
	// adds no static import of its own. The tracker checks GPC / Do Not Track before every send.
	if (__ANALYTICS_HOST__ && __ANALYTICS_WEBSITE_ID__) {
		const tracker = Promise.all([import('$lib/analytics/beacon'), import('$lib/site')]).then(
			([{ createTracker }, { ANALYTICS, SITE_BASE }]) =>
				createTracker({ host: ANALYTICS.host, websiteId: ANALYTICS.websiteId, base: SITE_BASE })
		);
		let first = true;
		afterNavigate(({ to }) => {
			if (!to) return;
			// Only the first load can carry an external referrer; later navigations are same-site.
			const referrer = first ? document.referrer : '';
			first = false;
			const url = to.url;
			const width = window.innerWidth;
			void tracker.then((t) => t.pageview(url, referrer, width)).catch(() => {});
		});
	}
</script>

<SkipLink />
{@render children()}
<LiveAnnouncer />
