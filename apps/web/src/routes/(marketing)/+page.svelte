<script lang="ts">
	import { resolve } from '$app/paths';
	import ButtonLink from '$lib/components/ui/ButtonLink.svelte';
	import PortalCard from '$lib/components/marketing/PortalCard.svelte';
	import HowItWorks from '$lib/components/marketing/HowItWorks.svelte';
	import TrustStrip from '$lib/components/marketing/TrustStrip.svelte';
	import RenterMark from '$lib/components/brand/marks/RenterMark.svelte';
	import InvestorMark from '$lib/components/brand/marks/InvestorMark.svelte';
	import AgentMark from '$lib/components/brand/marks/AgentMark.svelte';

	const description =
		'Browser-based real estate tools for renters, investors, and agents. Listing data from RentCast, your own API keys, and no Tran server.';

	const contours = [
		'M417.5 110C418.3 117.6 412.2 130.4 404.6 134.8C397 139.1 382.9 136.2 372 136.2C361.1 136.2 347 139.1 339.4 134.8C331.8 130.4 325.7 117.6 326.5 110C327.4 102.4 336.9 94.8 344.5 89.1C352.1 83.4 362.8 76.1 372 76.1C381.2 76.1 391.9 83.4 399.5 89.1C407.1 94.8 416.6 102.4 417.5 110Z',
		'M462 110C463.7 123.7 446.6 146.9 431.6 155.3C416.7 163.7 392.3 160 372 160.3C351.7 160.6 323.5 165.4 310.1 157.1C296.6 148.7 290.2 124.9 291.3 110C292.3 95.1 302.7 78.1 316.2 67.6C329.6 57 354.5 46 372 46.9C389.5 47.7 405.9 62.3 420.9 72.8C435.9 83.4 460.2 96.3 462 110Z',
		'M508.2 110C510.5 129.5 478.9 161 456.2 174C433.6 187.1 401 187.7 372 188.4C343 189 301.2 191.1 282.5 178.1C263.7 165 259.4 132.6 259.6 110C259.8 87.4 264.8 57.7 283.5 42.7C302.2 27.8 345.6 17.7 372 20.1C398.4 22.4 419.4 41.8 442.1 56.8C464.8 71.7 505.8 90.5 508.2 110Z',
		'M552.3 110C554.5 135.4 509 172.7 479 191.3C448.9 209.9 408.8 220.8 372 221.7C335.2 222.5 282.3 214.9 258.5 196.3C234.6 177.7 230.6 140.1 228.8 110C227 79.9 223.9 34.5 247.8 15.6C271.6 -3.4 335.7 -7.5 372 -3.7C408.3 0.2 435.6 19.9 465.7 38.8C495.7 57.8 550.1 84.6 552.3 110Z',
		'M590.4 110C591.7 141.8 538.1 183.6 501.7 208.6C465.3 233.5 415.8 259.5 372 259.9C328.2 260.3 268.5 236 239.1 211C209.7 186 200.2 147.1 195.6 110C191.1 72.9 182.3 10.7 211.7 -11.8C241.1 -34.4 325 -30.2 372 -25.3C419 -20.4 457.1 -4.9 493.5 17.6C529.9 40.2 589 78.2 590.4 110Z',
		'M619.7 110C619.8 149.1 568 195.8 526.7 227.6C485.4 259.3 422.5 301.5 372 300.7C321.5 300 259.3 254.6 223.5 222.8C187.7 191.1 164.8 153.3 157.4 110C149.9 66.7 142.9 -10.7 178.7 -36.9C214.5 -63.1 314.1 -52.1 372 -47.1C429.9 -42.2 484.8 -33.3 526.1 -7.1C567.4 19.1 619.6 70.9 619.7 110Z',
		'M639.8 110C638.8 157.3 600.5 211.3 555.9 249.8C511.3 288.2 429.8 343.4 372 340.7C314.2 338 252.5 272 209.4 233.6C166.2 195.2 122.9 158.5 113.3 110C103.7 61.5 108.7 -27 151.8 -57.4C194.9 -87.7 303.7 -76.2 372 -72.4C440.3 -68.5 517.3 -64.7 561.9 -34.3C606.5 -3.9 640.8 62.7 639.8 110Z'
	];
</script>

<svelte:head>
	<title>Tran Real Estate Tools: tools for renters, investors, and agents</title>
	<meta name="description" content={description} />
</svelte:head>

<section class="hero relative overflow-clip">
	<svg
		aria-hidden="true"
		focusable="false"
		class="pointer-events-none absolute top-0 right-0 hidden md:block"
		width="480"
		height="360"
		viewBox="0 0 480 360"
		fill="none"
	>
		{#each contours as d (d)}
			<path class="stroke-border" stroke-width="1" {d} />
		{/each}
	</svg>
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
			<ButtonLink href="#how-it-works" variant="secondary">How it works</ButtonLink>
		</div>

		<div id="portals" class="mt-8 lg:mt-12">
			<h2 class="font-display text-heading font-semibold">Pick a portal</h2>
			<div class="mt-6 grid gap-6 md:grid-cols-3">
				<PortalCard
					title="Renter"
					body="Search rentals anywhere in the US, track what's new, and compare asking rent to the local market."
					href={resolve('/for-renters/')}
					linkLabel="Explore renter tools"
					mark={RenterMark}
				/>
				<PortalCard
					title="Investor"
					body="Analyze a property's cash flow, cap rate, and DSCR, then save deals and compare them side by side."
					href={resolve('/for-investors/')}
					linkLabel="Explore investor tools"
					mark={InvestorMark}
				/>
				<PortalCard
					title="Agent"
					body="Keep leads, follow-ups, and listing content in one place, with your disclosures added for you."
					href={resolve('/for-agents/')}
					linkLabel="Explore agent tools"
					mark={AgentMark}
				/>
			</div>
		</div>
	</div>
</section>

<HowItWorks />
<TrustStrip />

<style>
	.hero {
		background-image:
			radial-gradient(60% 55% at 88% 8%, var(--color-accent-surface) 0%, transparent 70%),
			radial-gradient(45% 40% at 4% 92%, var(--color-secondary-surface) 0%, transparent 70%);
	}
</style>
