<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Tran Real Estate Tools</title>
</svelte:head>

<h1>Tran Real Estate Tools</h1>
<p>Tools for renters, investors, and agents.</p>
<ul>
	<li><a href={resolve('/renter/')}>Renter portal</a></li>
	<li><a href={resolve('/investor/')}>Investor portal</a></li>
	<li><a href={resolve('/agent/')}>Agent portal</a></li>
</ul>
