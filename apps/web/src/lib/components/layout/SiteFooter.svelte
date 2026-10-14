<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { BUILD_YEAR } from '$lib/build-info';

	type FooterLink = { href: string; label: string; id: string };

	// `satisfies` (not a `: FooterLink[]` annotation) keeps the resolve() calls traceable for
	// eslint svelte/no-navigation-without-resolve.
	const portals = [
		{ href: resolve('/renter/'), label: 'Renter', id: '/(app)/renter' },
		{ href: resolve('/investor/'), label: 'Investor', id: '/(app)/investor' },
		{ href: resolve('/agent/'), label: 'Agent', id: '/(app)/agent' }
	] satisfies FooterLink[];
	const learn = [
		{ href: resolve('/for-renters/'), label: 'For renters', id: '/(marketing)/for-renters' },
		{ href: resolve('/for-investors/'), label: 'For investors', id: '/(marketing)/for-investors' },
		{ href: resolve('/for-agents/'), label: 'For agents', id: '/(marketing)/for-agents' }
	] satisfies FooterLink[];
	const tools = [
		{
			href: resolve('/tools/affordability/'),
			label: 'Rent affordability',
			id: '/(marketing)/tools/affordability'
		},
		{ href: resolve('/tools/cap-rate/'), label: 'Cap rate', id: '/(marketing)/tools/cap-rate' },
		{
			href: resolve('/tools/cash-on-cash/'),
			label: 'Cash-on-cash return',
			id: '/(marketing)/tools/cash-on-cash'
		},
		{ href: resolve('/tools/dscr/'), label: 'DSCR', id: '/(marketing)/tools/dscr' },
		{ href: resolve('/tools/'), label: 'All calculators', id: '/(marketing)/tools' }
	] satisfies FooterLink[];
	const legal = [
		{ href: resolve('/legal/privacy/'), label: 'Privacy', id: '/(marketing)/legal/privacy' },
		{ href: resolve('/legal/terms/'), label: 'Terms', id: '/(marketing)/legal/terms' },
		{
			href: resolve('/legal/fair-housing/'),
			label: 'Fair Housing',
			id: '/(marketing)/legal/fair-housing'
		},
		{
			href: resolve('/legal/data-coverage/'),
			label: 'Data coverage',
			id: '/(marketing)/legal/data-coverage'
		}
	] satisfies FooterLink[];

	const current = (id: string) => (page.route.id === id ? 'page' : undefined);
	const heading = 'text-label font-semibold tracking-[0.06em] text-secondary uppercase';
	const link =
		'inline-flex min-h-11 items-center text-body hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline aria-[current=page]:decoration-primary';
</script>

<footer class="mt-auto bg-surface pt-12 md:pt-16">
	<div class="mx-auto max-w-page px-6 md:px-8">
		<!-- UI-SPEC "SiteFooter changes": wordmark | Portals + Learn | Tools | Legal. One column below
		     768px, 2 x 2 from 768px, 4 columns from 1024px. The Footer nav uses display: contents so
		     its three groups sit in the same grid as the wordmark (the landmark stays in the a11y tree). -->
		<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
			<div>
				<p class="font-display text-heading font-semibold">Tran Real Estate Tools</p>
				<p class="mt-4 text-label text-muted-foreground">
					Tran Real Estate Tools is software, not a real estate brokerage. Nothing on this site is
					investment, legal, or tax advice. Listing data comes from RentCast and may be incomplete
					or out of date.
				</p>
			</div>
			<nav aria-label="Footer" class="contents">
				<div class="grid content-start gap-8">
					<div>
						<h2 class={heading}>Portals</h2>
						<ul class="mt-2">
							{#each portals as l (l.id)}
								<li><a href={l.href} aria-current={current(l.id)} class={link}>{l.label}</a></li>
							{/each}
						</ul>
					</div>
					<div>
						<h2 class={heading}>Learn</h2>
						<ul class="mt-2">
							{#each learn as l (l.id)}
								<li><a href={l.href} aria-current={current(l.id)} class={link}>{l.label}</a></li>
							{/each}
						</ul>
					</div>
				</div>
				<div>
					<h2 class={heading}>Tools</h2>
					<ul class="mt-2">
						{#each tools as l (l.id)}
							<li><a href={l.href} aria-current={current(l.id)} class={link}>{l.label}</a></li>
						{/each}
					</ul>
				</div>
				<div>
					<h2 class={heading}>Legal</h2>
					<ul class="mt-2">
						{#each legal as l (l.id)}
							<li><a href={l.href} aria-current={current(l.id)} class={link}>{l.label}</a></li>
						{/each}
					</ul>
				</div>
			</nav>
		</div>
		<div class="mt-12 border-t border-border py-6 text-label text-muted-foreground">
			<p>
				Equal Housing Opportunity. Tran Real Estate Tools supports the Fair Housing Act and does not
				allow its tools to filter or target people by a protected characteristic.
			</p>
			<p class="mt-2">© {BUILD_YEAR} Tran Real Estate Tools</p>
		</div>
	</div>
</footer>
