<script lang="ts">
	import LegalPage from '$lib/components/legal/LegalPage.svelte';
	import ExternalLink from '$lib/components/legal/ExternalLink.svelte';

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

<LegalPage title="Privacy policy" docTitle="Privacy policy: Tran Real Estate Tools" {description}>
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

	<h2>What we don't do</h2>
	<p>
		There are no third-party analytics, ads, or tracking scripts on this site. If first-party usage
		counting is added, it will carry no personal data, and this page will be updated first.
	</p>

	<h2>Deleting your data</h2>
	<p>
		To remove everything Tran has stored, clear this site's data in your browser settings. A control
		to forget your keys arrives with Settings.
	</p>

	<h2>Contact</h2>
	<p>Contact details will be posted here before public launch.</p>
</LegalPage>
