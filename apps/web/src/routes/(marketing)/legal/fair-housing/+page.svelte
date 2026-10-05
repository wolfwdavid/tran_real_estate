<script lang="ts">
	import LegalPage from '$lib/components/legal/LegalPage.svelte';
	import ExternalLink from '$lib/components/legal/ExternalLink.svelte';

	const description =
		'Tran Real Estate Tools supports the Fair Housing Act. How the tools avoid protected characteristics, and how to report a concern.';

	const characteristics = [
		'Race',
		'Color',
		'Religion',
		'Sex (including sexual orientation and gender identity)',
		'National origin',
		'Familial status',
		'Disability'
	];
</script>

<LegalPage
	title="Fair Housing statement"
	docTitle="Fair Housing statement: Tran Real Estate Tools"
	{description}
>
	<h2>Our commitment</h2>
	<p>
		Tran Real Estate Tools supports the federal Fair Housing Act and equal housing opportunity for
		everyone.
	</p>

	<h2>Protected characteristics</h2>
	<p>
		The Fair Housing Act prohibits discrimination in housing because of race, color, religion, sex
		(including sexual orientation and gender identity), national origin, familial status, and
		disability:
	</p>
	<ul>
		{#each characteristics as characteristic (characteristic)}
			<li>{characteristic}</li>
		{/each}
	</ul>
	<p>State and local laws may protect more characteristics.</p>

	<h2>How the tools behave</h2>
	<p>Search filters never use protected characteristics.</p>
	<p>
		AI-drafted housing copy is checked for problem phrases before it can be copied, starting with
		the portals that generate copy.
	</p>

	<h2>Report a concern</h2>
	<p>
		If you believe you have experienced housing discrimination, you can <ExternalLink
			href="https://www.hud.gov/program_offices/fair_housing_equal_opp/online-complaint"
			>file a fair housing complaint with HUD</ExternalLink
		>.
	</p>
</LegalPage>
