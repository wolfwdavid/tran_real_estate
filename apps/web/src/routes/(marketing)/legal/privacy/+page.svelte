<script lang="ts">
	import LegalPage from '$lib/components/legal/LegalPage.svelte';
	import ExternalLink from '$lib/components/legal/ExternalLink.svelte';
	import { ANALYTICS, SITE_BASE, SITE_ORIGIN } from '$lib/site';

	// Name the exact counter host so the page states where counts go, whoever runs the server.
	const counterHost = ANALYTICS.host ? new URL(ANALYTICS.host).host : '';
	// Under a sub-path build the browser storage area belongs to the whole host (every project site
	// on it), so the deletion section names that host. It comes from the build's site origin, never a
	// literal, and the paragraph disappears on an origin-root build such as a custom domain.
	const siteHost = new URL(SITE_ORIGIN).host;

	const description =
		'How Tran Real Estate Tools handles your data: no accounts, no Tran server, and requests that go straight from your browser to the services you choose.';

	const policies = [
		{ label: 'RentCast privacy policy', href: 'https://www.rentcast.io/privacy' },
		{ label: 'Anthropic privacy policy', href: 'https://www.anthropic.com/legal/privacy' },
		{ label: 'OpenAI privacy policy', href: 'https://openai.com/policies/privacy-policy/' },
		{ label: 'Google privacy policy', href: 'https://policies.google.com/privacy' },
		{ label: 'OpenRouter privacy policy', href: 'https://openrouter.ai/privacy' },
		{ label: 'Web3Forms privacy policy', href: 'https://web3forms.com/privacy' }
	];
</script>

<LegalPage
	title="Privacy policy"
	docTitle="Privacy policy: Tran Real Estate Tools"
	{description}
	updated="30 October 2026"
>
	<h2>The short version</h2>
	<p>
		Tran has no accounts and no server that stores your data. What you save stays in this browser.
	</p>

	<h2>What stays in your browser</h2>
	<p>
		Your saved searches, deals, contacts, and drafts are kept in your browser's storage on this
		device. They are not sent to Tran.
	</p>
	<p>
		API keys are kept for the browser session only, unless you choose "remember on this device".
	</p>

	<h2>Where requests go</h2>
	<p>
		Requests go directly from your browser to the services you use, and only those: RentCast,
		Anthropic, OpenAI, Google, OpenRouter, or Web3Forms. Each provider's own privacy policy applies
		to what you send them.
	</p>
	<ul>
		{#each policies as policy (policy.href)}
			<li><ExternalLink href={policy.href}>{policy.label}</ExternalLink></li>
		{/each}
	</ul>
	<p>
		The waitlist and feedback forms send what you type to Web3Forms, a form service, which emails it
		to the Tran team. Nothing is sent until you submit. Each message is labeled with the form it
		came from, such as which waitlist you joined or which part of Tran your feedback is about.
		Nothing else on the page is sent with it. Like any web request, it reaches Web3Forms with your
		IP address and browser type.
	</p>

	<h2>Usage counts</h2>
	{#if ANALYTICS.host}
		<p>
			Tran counts page views so we can see which pages and portals people use. Counts go to Tran's
			Umami counter at {counterHost}, not to an ad company. There are no cookies, no identifiers,
			and no third-party scripts.
		</p>
		<p>
			Each page view sends only: the page's path (without anything after a ? or #), which portal it
			belongs to, the domain of the site that linked you here (not the full address), and a screen
			size group: small, medium, or large.
		</p>
		<p>
			It never sends your API keys, anything you type, your saved searches, deals, or contacts, or a
			way to recognize you on a later visit.
		</p>
		<p>
			Like any web request, it reaches the server with your IP address and browser type. Tran's code
			doesn't add them to what it sends.
		</p>
		<p>If your browser sends Do Not Track or Global Privacy Control, nothing is sent.</p>
	{:else}
		<p>
			Tran doesn't count visits right now. If that changes, this section will describe exactly
			what's sent before counting starts.
		</p>
	{/if}

	<h2>What we don't do</h2>
	{#if ANALYTICS.host}
		<p>We don't use third-party analytics, ads, or tracking scripts.</p>
	{:else}
		<p>We don't use third-party analytics, ads, or tracking scripts, and we don't count visits.</p>
	{/if}

	<h2>Deleting your data</h2>
	<p>
		To remove the keys Tran has stored, open Settings and choose <strong>Forget all keys</strong>.
		Saved searches, deals, contacts and drafts can be deleted where you saved them, or all at once
		by clearing site data in your browser settings.
	</p>
	{#if SITE_BASE}
		<p data-shared-origin>
			This site shares its browser storage area with other sites hosted at {siteHost}. Clearing site
			data in your browser settings also clears what those sites stored, and a key you chose to
			remember on this device can be read by scripts on those sites. Keys stay session-only unless
			you choose to remember them.
		</p>
	{/if}

	<h2>Contact</h2>
	<p>Contact details will be posted here before public launch.</p>

	<h2 id="browser-extension">Sponsored Listing Filter extension</h2>
	<p>
		The Sponsored Listing Filter — for Zillow browser extension runs only on zillow.com pages. It
		reads the short labels on listing cards, such as "Sponsored" or "Promoted", to find paid
		placements and dims them. You can show any card with one click.
	</p>
	<p>
		It does not read prices, addresses, or any other listing details. It makes no network requests,
		sends nothing to Tran or anyone else, and has no analytics. Its only stored data is one on/off
		setting kept in your browser's extension storage.
	</p>
	<p>
		Permissions: storage, and access to zillow.com pages. Not affiliated with or endorsed by Zillow
		Group.
	</p>
</LegalPage>
