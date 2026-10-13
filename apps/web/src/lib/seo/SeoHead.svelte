<script lang="ts">
	// One component for every (marketing) page's head metadata (UI-SPEC "Head tags on every
	// (marketing) route", RESEARCH Patterns 2, 3 and 6). Absolute URLs come from SITE_URL plus the
	// route id: the paths base is relative during prerender and the request URL is the prerender origin, so
	// neither may build a canonical or og:* URL. Kit crawls the absolute og:image link, so a
	// missing share card fails the build.
	import { page } from '$app/state';
	import { DEFAULT_OG_ALT, type ToolSlug } from '$lib/content/tools';
	import { SITE_URL } from '$lib/site';
	import { serializeJsonLd } from './jsonld';
	import { canonicalPath } from './paths';

	interface Props {
		title: string;
		description: string;
		/** Share card under /og/<name>.png (emitted by the prerendered og endpoints). */
		ogImage?: 'default' | 'tools' | ToolSlug;
		ogAlt?: string;
		/** JSON-LD objects, rendered as data blocks (never executed; CSP unchanged). */
		jsonLd?: readonly object[];
	}

	let {
		title,
		description,
		ogImage = 'default',
		ogAlt = DEFAULT_OG_ALT,
		jsonLd = []
	}: Props = $props();

	const url = $derived(SITE_URL + canonicalPath(page.route.id));
	const image = $derived(`${SITE_URL}/og/${ogImage}.png`);
	// Passed as an expression: a literal `this="script"` is rejected by the compiler.
	const scriptTag = 'script';
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Tran Real Estate Tools" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={ogAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	{#each jsonLd as block, i (i)}
		<svelte:element this={scriptTag} type="application/ld+json"
			>{serializeJsonLd(block)}</svelte:element
		>
	{/each}
</svelte:head>
