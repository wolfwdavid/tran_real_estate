<script lang="ts">
	import LegalPage from '$lib/components/legal/LegalPage.svelte';
	import ExternalLink from '$lib/components/legal/ExternalLink.svelte';

	const description =
		'Where Tran Real Estate Tools gets listing data, what is not included, and the limits of automated estimates.';

	// Verbatim UI-SPEC wording; kept on one line so it stays searchable.
	const estimatesNote =
		'Rent and value figures are automated estimates. They are not professional valuations of a property and can be wrong.';
</script>

<LegalPage
	title="Where our data comes from"
	docTitle="Data coverage: Tran Real Estate Tools"
	{description}
>
	<h2>Where listings come from</h2>
	<p>
		Listings, rent and value estimates, and market figures come from the <ExternalLink
			href="https://www.rentcast.io/api">RentCast API</ExternalLink
		>, using your own RentCast key. Tran is not affiliated with RentCast.
	</p>

	<h2>What's not included</h2>
	<ul>
		<li>No MLS or IDX feeds</li>
		<li>No listing photos</li>
		<li>No CoStar or LoopNet data</li>
	</ul>

	<h2>Coverage gaps</h2>
	<p>
		Some areas and property types have few or no listings, and listing details can lag the market.
	</p>

	<h2>Estimates</h2>
	<p>{estimatesNote}</p>

	<h2>Sample data</h2>
	<p>Sample data is synthetic: the addresses and people are fictional.</p>
</LegalPage>
