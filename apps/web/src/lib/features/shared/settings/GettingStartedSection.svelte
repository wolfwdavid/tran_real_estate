<script lang="ts">
	// Settings section 8, "Getting started" (Phase 10, GTM-01 "re-openable from Settings"; UI-SPEC
	// "Settings addition"). Static: no vault or database, so it renders fully in the prerender.
	// "Show the tour again" resets the guide to `new` (keeping the last portal) and then follows its
	// href to /#get-started, where the guide focuses its h2 on arrival (10-15).
	import { resolve } from '$app/paths';
	import ButtonLink from '$lib/components/ui/ButtonLink.svelte';
	import { readOnboarding, writeOnboarding } from '$lib/components/onboarding/onboarding-state';
	import { SETTINGS_COPY as COPY } from '$lib/content/onboarding';

	const tourHref = `${resolve('/')}#get-started`;

	function resetTour() {
		writeOnboarding({ status: 'new', lastPortal: readOnboarding().lastPortal });
	}
</script>

<section id="getting-started" aria-labelledby="getting-started-heading">
	<h2 id="getting-started-heading" tabindex="-1" class="font-display text-heading font-semibold">
		{COPY.heading}
	</h2>
	<p class="mt-4 text-body">{COPY.paragraph}</p>
	<div class="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-4">
		<ButtonLink href={tourHref} variant="secondary" onclick={resetTour}>{COPY.showTour}</ButtonLink>
		<ButtonLink href={resolve('/setup/rentcast/')} variant="secondary">{COPY.setupKey}</ButtonLink>
	</div>
	<p class="mt-6 text-body">
		{COPY.feedbackBefore}<a
			href={resolve('/feedback/')}
			class="text-primary underline underline-offset-3 hover:text-primary-hover"
			>{COPY.feedbackLink}</a
		>{COPY.feedbackAfter}
	</p>
</section>
