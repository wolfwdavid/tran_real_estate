<script lang="ts">
	import { resolve } from '$app/paths';
	import LegalPage from '$lib/components/legal/LegalPage.svelte';

	const description =
		'Terms of use for Tran Real Estate Tools, a software tool. Not a brokerage, and not investment, legal, or tax advice.';
</script>

<LegalPage title="Terms of use" docTitle="Terms of use: Tran Real Estate Tools" {description}>
	<h2>What Tran is</h2>
	<p>
		Tran Real Estate Tools is a software tool that runs in your browser. It helps you search
		listings, do deal arithmetic, and draft messages using data and AI services you connect with
		your own keys.
	</p>

	<h2>What Tran is not</h2>
	<p>
		Tran Real Estate Tools is not a real estate brokerage and does not act as an agent for anyone.
		Nothing in the app is investment, legal, or tax advice.
	</p>
	<p>
		Decisions about renting, buying, listing, or pricing are yours. Talk to a licensed professional
		when you need advice.
	</p>

	<h2>Your keys and your provider accounts</h2>
	<p>
		When you connect a data or AI service with your own key, you agree to that provider's own terms.
		You are responsible for your accounts with them.
	</p>
	<p>
		RentCast's free plan has a monthly request limit. Adding a card to your RentCast account can
		turn requests over that limit into charges.
	</p>

	<h2>AI drafts</h2>
	<p>
		Review every draft before you use it. You are responsible for what you send, post, or publish.
	</p>

	<h2>Fair Housing</h2>
	<p>
		You agree not to use the tools to discriminate against anyone. Read our <a
			href={resolve('/legal/fair-housing/')}>Fair Housing statement</a
		>.
	</p>

	<h2>Data accuracy</h2>
	<p>
		Listing data, estimates, and market figures may be incomplete, delayed, or wrong. Verify
		anything important before you act on it.
	</p>

	<h2>No warranty</h2>
	<p>Tran Real Estate Tools is provided as is, without warranties of any kind.</p>

	<h2>Changes</h2>
	<p>These terms may change. The Last updated date at the top shows the current version.</p>
</LegalPage>
