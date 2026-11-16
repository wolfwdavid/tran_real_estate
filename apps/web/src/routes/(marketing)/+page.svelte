<script lang="ts">
	import { resolve } from '$app/paths';
	import ButtonLink from '#lib/components/ui/ButtonLink.svelte';
	import PortalCard from '#lib/components/marketing/PortalCard.svelte';
	import HowItWorks from '#lib/components/marketing/HowItWorks.svelte';
	import TrustStrip from '#lib/components/marketing/TrustStrip.svelte';
	import RenterMark from '#lib/components/brand/marks/RenterMark.svelte';
	import InvestorMark from '#lib/components/brand/marks/InvestorMark.svelte';
	import AgentMark from '#lib/components/brand/marks/AgentMark.svelte';
	import SeoHead from '#lib/seo/SeoHead.svelte';
	import GetStartedGuide from '#lib/components/onboarding/GetStartedGuide.svelte';

	const description =
		'Browser-based real estate tools for renters, investors, and agents. Listing data from RentCast, your own API keys, and no Tran server.';

	// Hero motif (480x360). Fetched as an asset: ?no-inline keeps it out of a data: URL, which img-src blocks.
	import contoursUrl from './hero-contours.svg?no-inline';
</script>

<SeoHead title="Tran Real Estate Tools: tools for renters, investors, and agents" {description} />

<section class="hero relative overflow-clip">
	<!-- Decorative contours: the SVG is an alpha mask over the border token, so it stays out of the page script. -->
	<div
		aria-hidden="true"
		class="hero-contours pointer-events-none absolute top-0 right-0 hidden h-[360px] w-[480px] bg-border md:block"
		style:mask-image="url({contoursUrl})"
		style:-webkit-mask-image="url({contoursUrl})"
	></div>
	<div class="relative mx-auto max-w-page px-6 pt-12 pb-12 md:px-8 lg:py-24">
		<p class="text-label font-semibold tracking-[0.06em] text-secondary uppercase">
			For renters, investors, and agents
		</p>
		<h1 class="mt-2 max-w-reading font-display text-display font-semibold">
			Real estate tools that do the refreshing for you
		</h1>
		<p class="mt-4 max-w-reading text-body">
			Save a search once and come back to what's new. Run deal math on any property. Draft the
			message, then send it yourself. Tran Real Estate Tools runs in your browser with listing data
			from RentCast and your own API keys.
		</p>
		<div class="mt-8 flex flex-col gap-2 sm:flex-row sm:gap-4">
			<ButtonLink href="#portals" variant="primary">Choose your portal</ButtonLink>
			<ButtonLink href="#get-started" variant="secondary">Show me around</ButtonLink>
		</div>

		<div id="portals" class="mt-8 lg:mt-12">
			<h2 class="font-display text-heading font-semibold">Pick a portal</h2>
			<div class="mt-6 grid gap-6 md:grid-cols-3">
				<PortalCard
					title="Renter"
					body="Search rentals anywhere in the US, track what's new, and compare asking rent to the local market."
					href={resolve('for-renters/')}
					linkLabel="Explore renter tools"
					mark={RenterMark}
				/>
				<PortalCard
					title="Investor"
					body="Analyze a property's cash flow, cap rate, and DSCR, then save deals and compare them side by side."
					href={resolve('for-investors/')}
					linkLabel="Explore investor tools"
					mark={InvestorMark}
				/>
				<PortalCard
					title="Agent"
					body="Keep leads, follow-ups, and listing content in one place, with your disclosures added for you."
					href={resolve('for-agents/')}
					linkLabel="Explore agent tools"
					mark={AgentMark}
				/>
			</div>
		</div>
	</div>
</section>

<GetStartedGuide />
<HowItWorks />
<TrustStrip />

<style>
	.hero {
		background-image:
			radial-gradient(60% 55% at 88% 8%, var(--color-accent-surface) 0%, transparent 70%),
			radial-gradient(45% 40% at 4% 92%, var(--color-secondary-surface) 0%, transparent 70%);
	}
	.hero-contours {
		mask-repeat: no-repeat;
		mask-size: 480px 360px;
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-size: 480px 360px;
	}
</style>
