<script lang="ts">
	// The shared frame for every /tools/*/ page (UI-SPEC "Tool pages", 9-item section order; the
	// footer comes from the marketing layout). Everything renders from one ToolContent object: the
	// visible FAQ and the FAQPage JSON-LD read the same `tool.faq`, so they cannot drift.
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { faqPage, webApplication } from '$lib/seo/jsonld';
	import { SITE_URL } from '$lib/site';
	import {
		AFFORDABILITY_READY,
		SHARED_TOOL_COPY as C,
		TOOL_NAMES,
		TOOL_SLUGS,
		type ToolContent,
		type ToolSlug
	} from '$lib/content/tools/shared';
	import Breadcrumb from './Breadcrumb.svelte';
	import ToolIcon from './ToolIcon.svelte';

	let { tool, children }: { tool: ToolContent; children: Snippet } = $props();

	const url = $derived(SITE_URL + '/tools/' + tool.slug + '/');

	// Typed literal maps keep every resolve() call checked.
	const primaryHrefs = {
		'/investor/analyze/': resolve('/investor/analyze/'),
		'/renter/': resolve('/renter/')
	};
	const sampleHrefs = {
		'/investor/': `${resolve('/investor/')}?source=sample`,
		'/renter/': `${resolve('/renter/')}?source=sample`
	};
	const toolHrefs: Record<ToolSlug, string> = {
		// Built from the hub path: /tools/affordability/ is not a route until 10-14.
		affordability: `${resolve('/tools/')}affordability/`,
		'cap-rate': resolve('/tools/cap-rate/'),
		'cash-on-cash': resolve('/tools/cash-on-cash/'),
		dscr: resolve('/tools/dscr/')
	};

	// ButtonLink's classes, inlined: ButtonLink and its Lucide arrow are two extra chunks on a
	// calculator page, and the tool-page budget (60 KB gz) has no room for them (10-13).
	const cta =
		'inline-flex min-h-12 cursor-pointer touch-manipulation items-center justify-center gap-1 rounded-md px-6 text-body font-semibold transition-colors duration-150 ease-out motion-safe:active:translate-y-px';

	const primaryHref = $derived(primaryHrefs[tool.goFurther.primary.path]);
	const sampleHref = $derived(sampleHrefs[tool.goFurther.sample.path]);
	const others = $derived(
		TOOL_SLUGS.filter((s) => s !== tool.slug && (AFFORDABILITY_READY || s !== 'affordability'))
	);
</script>

<SeoHead
	title={tool.docTitle}
	description={tool.description}
	ogImage={tool.slug}
	ogAlt={tool.ogAlt}
	jsonLd={[
		webApplication({ name: tool.h1, description: tool.description, url }),
		faqPage(tool.faq)
	]}
/>

<div class="mx-auto max-w-page space-y-12 px-6 md:space-y-16 md:px-8">
	<Breadcrumb current={tool.name} />

	<header class="space-y-4">
		<p class="text-label font-semibold tracking-[0.06em] text-secondary uppercase">
			{C.eyebrow}
		</p>
		<h1 class="font-display text-display font-semibold [text-wrap:balance]">{tool.h1}</h1>
		<p class="max-w-reading text-body">{tool.lead}</p>
		<p class="flex gap-1 text-label text-muted-foreground">
			<ToolIcon name="server-off" size={16} class="mt-0.5 shrink-0" />
			<span>{C.privacy}</span>
		</p>
	</header>

	{@render children()}

	<aside
		aria-labelledby="disclaimer-title"
		class="flex max-w-reading gap-3 rounded-lg border-l-4 border-secondary bg-secondary-surface p-4 sm:p-6"
	>
		<ToolIcon name="info" size={20} class="mt-0.5 shrink-0 text-secondary" />
		<div class="space-y-1">
			<p id="disclaimer-title" class="font-semibold">General guidelines, not financial advice</p>
			<p>{C.disclaimerBody}</p>
		</div>
	</aside>

	<section aria-labelledby="how-heading" class="max-w-reading space-y-4">
		<h2 id="how-heading" class="font-display text-heading font-semibold">How it's calculated</h2>
		<dl class="space-y-3">
			{#each tool.formula as line (line.term)}
				<div>
					<dt class="font-semibold">{line.term}</dt>
					<dd class="[overflow-wrap:anywhere]">{line.def}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section id="questions" aria-labelledby="questions-heading" class="max-w-reading space-y-6">
		<h2 id="questions-heading" class="font-display text-heading font-semibold">Questions</h2>
		{#each tool.faq as item (item.q)}
			<div class="space-y-2">
				<h3 class="text-body font-semibold">{item.q}</h3>
				<p>{item.a}</p>
			</div>
		{/each}
	</section>
</div>

<section aria-labelledby="further-heading" class="mt-12 bg-surface py-12 md:mt-16 md:py-16">
	<div class="mx-auto max-w-page space-y-4 px-6 md:px-8">
		<h2 id="further-heading" class="font-display text-heading font-semibold">
			{tool.goFurther.heading}
		</h2>
		<p class="max-w-reading text-body">{tool.goFurther.body}</p>
		<div class="flex flex-wrap gap-4 pt-2">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- both hrefs are resolve() output -->
			<a
				href={primaryHref}
				class={[cta, 'bg-primary text-primary-foreground hover:bg-primary-hover']}
				>{tool.goFurther.primary.label}<ToolIcon name="arrow-right" size={16} /></a
			>
			<a
				href={sampleHref}
				class={[cta, 'border border-border-strong text-foreground hover:bg-surface']}
				>Try sample data</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	</div>
</section>

<section
	aria-labelledby="other-heading"
	class="mx-auto max-w-page space-y-4 px-6 py-12 md:px-8 md:py-16"
>
	<h2 id="other-heading" class="font-display text-heading font-semibold">Other free calculators</h2>
	<ul>
		<!-- eslint-disable svelte/no-navigation-without-resolve -- toolHrefs holds resolve() output -->
		{#each others as slug (slug)}
			<li>
				<a
					href={toolHrefs[slug]}
					class="inline-flex min-h-11 items-center text-primary underline decoration-1 underline-offset-[3px]"
					>{TOOL_NAMES[slug]}</a
				>
			</li>
		{/each}
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<li>
			<a
				href={resolve('/tools/')}
				class="inline-flex min-h-11 items-center font-semibold text-primary underline decoration-1 underline-offset-[3px]"
				>{C.allCalculators}</a
			>
		</li>
	</ul>
</section>
