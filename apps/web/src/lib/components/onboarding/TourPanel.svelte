<script lang="ts">
	// Tour steps 1-3. Loaded on demand by GetStartedGuide (the landing prerenders step 0 only), so
	// the tour copy and markup stay out of the landing's initial JS.
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { GUIDE_COPY as G, TOURS, type TourStep } from '$lib/content/onboarding';
	import TourProgress from './TourProgress.svelte';
	import { BTN } from './guide-buttons';
	import type { OnboardingPortal } from './onboarding-state';

	let {
		portal,
		step,
		sampleHref,
		otherHref,
		ongo,
		onfinish,
		stepEl = $bindable()
	}: {
		portal: OnboardingPortal;
		step: 1 | 2 | 3;
		/** Try sample data target. */
		sampleHref: string;
		/** Key setup (renter, investor) or empty pipeline (agent) target. */
		otherHref: string;
		ongo: (step: 0 | 1 | 2 | 3) => void;
		onfinish: () => void;
		stepEl?: HTMLHeadingElement;
	} = $props();

	const current: TourStep = $derived(TOURS[portal][step - 1]);
</script>

<div class="flex flex-wrap items-center justify-between gap-2">
	<p class="text-label font-semibold tracking-[0.06em] text-secondary uppercase">
		{G.tourHeader[portal]}
	</p>
	<TourProgress {step} />
</div>
<h3
	tabindex="-1"
	bind:this={stepEl}
	class="mt-4 font-display text-heading font-semibold focus:outline-none"
>
	{current.title}
</h3>
{#if current.list}
	<ul class="mt-4 max-w-reading list-disc space-y-2 pl-6 text-body">
		{#each current.list as item (item)}
			<li>{item}</li>
		{/each}
	</ul>
{:else if current.body}
	<p class="mt-4 max-w-reading text-body">{current.body}</p>
{/if}

<div class="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-4">
	<button type="button" class={BTN.outline} onclick={() => ongo((step - 1) as 0 | 1 | 2)}>
		<ArrowLeft size={16} aria-hidden="true" />{step === 1 ? G.buttons.changePortal : G.buttons.back}
	</button>
	{#if step < 3}
		<button type="button" class={BTN.primary} onclick={() => ongo((step + 1) as 2 | 3)}>
			{G.buttons.next}<ArrowRight size={16} aria-hidden="true" />
		</button>
		<button type="button" class={BTN.link} onclick={() => ongo(3)}>{G.buttons.skip}</button>
	{:else}
		<!-- Each exit records the choice before the browser follows the link (no preventDefault). -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -- the guide passes resolve() output -->
		<a href={sampleHref} class={BTN.primary} onclick={onfinish}>{G.buttons.sample}</a>
		<a href={otherHref} class={BTN.outline} onclick={onfinish}>
			{portal === 'agent' ? G.buttons.empty : G.buttons.key}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}
</div>
{#if step === 3 && portal !== 'agent'}
	<p class="mt-4 text-label text-muted-foreground">{G.step3Helper}</p>
{/if}
