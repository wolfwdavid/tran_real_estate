<script lang="ts">
	import { resolve } from '$app/paths';
	import Breadcrumb from '$lib/components/tools/Breadcrumb.svelte';
	import ToolCard from '$lib/components/tools/ToolCard.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { AFFORDABILITY_READY, CRUMBS, TOOL_SLUGS, type ToolSlug } from '$lib/content/tools/meta';
	import { TOOL_CARDS, TOOLS_HUB } from '$lib/content/tools/hub';

	// Typed literal paths keep resolve() checked.
	const hrefs: Record<ToolSlug, string> = {
		affordability: resolve('/tools/affordability/'),
		'cap-rate': resolve('/tools/cap-rate/'),
		'cash-on-cash': resolve('/tools/cash-on-cash/'),
		dscr: resolve('/tools/dscr/')
	};
	const slugs = TOOL_SLUGS.filter((s) => AFFORDABILITY_READY || s !== 'affordability');
</script>

<SeoHead
	title={TOOLS_HUB.docTitle}
	description={TOOLS_HUB.description}
	ogImage="tools"
	ogAlt={TOOLS_HUB.ogAlt}
/>

<div class="mx-auto max-w-page space-y-8 px-6 pb-12 md:px-8 md:pb-16">
	<Breadcrumb current={CRUMBS.tools} />

	<header class="space-y-4">
		<h1 class="font-display text-display font-semibold [text-wrap:balance]">
			Free real estate calculators
		</h1>
		<p class="max-w-reading text-body">{TOOLS_HUB.lead}</p>
	</header>

	<ul class="grid gap-6 md:grid-cols-2">
		{#each slugs as slug (slug)}
			<li>
				<ToolCard {...TOOL_CARDS[slug]} href={hrefs[slug]} />
			</li>
		{/each}
	</ul>
</div>
