<script lang="ts">
	import { resolve } from '$app/paths';
	import ButtonLink from '$lib/components/ui/ButtonLink.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import type { Audience, FeatureIcon } from '$lib/content/audiences';
	import Search from '@lucide/svelte/icons/search';
	import Bell from '@lucide/svelte/icons/bell';
	import Scale from '@lucide/svelte/icons/scale';
	import MessageSquareText from '@lucide/svelte/icons/message-square-text';
	import Calculator from '@lucide/svelte/icons/calculator';
	import Columns2 from '@lucide/svelte/icons/columns-2';
	import Target from '@lucide/svelte/icons/target';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Inbox from '@lucide/svelte/icons/inbox';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import FileText from '@lucide/svelte/icons/file-text';

	let { audience }: { audience: Audience } = $props();

	// Typed literal paths keep resolve() checked. Both CTAs open the portal until sample mode ships.
	const portalHref = {
		renter: resolve('/renter/'),
		investor: resolve('/investor/'),
		agent: resolve('/agent/')
	};
	const href = $derived(portalHref[audience.portal]);

	const icons: Record<FeatureIcon, typeof Search> = {
		search: Search,
		bell: Bell,
		scale: Scale,
		'message-square-text': MessageSquareText,
		calculator: Calculator,
		'columns-2': Columns2,
		target: Target,
		'map-pin': MapPin,
		inbox: Inbox,
		'list-checks': ListChecks,
		'pen-line': PenLine,
		'file-text': FileText
	};
</script>

<SeoHead title={audience.docTitle} description={audience.description} />

<section class="mx-auto max-w-page px-6 py-12 md:px-8 lg:py-24">
	<p class="text-label font-semibold tracking-[0.06em] text-secondary uppercase">
		{audience.eyebrow}
	</p>
	<h1 class="mt-2 max-w-reading font-display text-display font-semibold">{audience.title}</h1>
	<p class="mt-4 max-w-reading text-body">{audience.lead}</p>
	<div class="mt-8 flex flex-col gap-2 sm:flex-row sm:gap-4">
		<ButtonLink {href} variant="primary" arrow>{audience.openLabel}</ButtonLink>
		<ButtonLink {href} variant="secondary">Try sample data</ButtonLink>
	</div>
</section>

<section aria-labelledby="features-heading" class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	<h2 id="features-heading" class="font-display text-heading font-semibold">
		{audience.featuresHeading}
	</h2>
	<ul class="mt-6 grid gap-6 md:grid-cols-2">
		{#each audience.features as feature (feature.title)}
			{@const Icon = icons[feature.icon]}
			<li class="rounded-lg border border-border bg-card p-6 shadow-card">
				<Icon size={24} class="text-secondary" aria-hidden="true" />
				<h3 class="mt-4 text-body font-semibold">{feature.title}</h3>
				<p class="mt-2 text-muted-foreground">{feature.body}</p>
			</li>
		{/each}
	</ul>
</section>

<section aria-labelledby="limits-heading" class="mx-auto max-w-page px-6 md:px-8">
	<div class="rounded-lg border-l-4 border-secondary bg-secondary-surface p-6">
		<h2 id="limits-heading" class="font-display text-heading font-semibold">Good to know</h2>
		<ul class="mt-4 list-disc space-y-2 pl-6">
			{#each audience.limits as limit (limit)}
				<li>{limit}</li>
			{/each}
		</ul>
	</div>
</section>

<section aria-labelledby="closing-heading" class="mt-12 bg-surface py-12 md:mt-16 md:py-16">
	<div class="mx-auto max-w-page px-6 md:px-8">
		<h2 id="closing-heading" class="font-display text-heading font-semibold">
			{audience.closingHeading}
		</h2>
		<ButtonLink {href} variant="primary" arrow class="mt-6">{audience.openLabel}</ButtonLink>
	</div>
</section>
