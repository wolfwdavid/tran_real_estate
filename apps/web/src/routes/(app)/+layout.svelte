<script lang="ts">
	import { resolve } from '$app/paths';

	let { children } = $props();
</script>

<nav aria-label="Portals">
	<ul>
		<li><a href={resolve('/')}>Home</a></li>
		<li><a href={resolve('/renter/')}>Renter</a></li>
		<li><a href={resolve('/investor/')}>Investor</a></li>
		<li><a href={resolve('/agent/')}>Agent</a></li>
		<li><a href={resolve('/settings/')}>Settings</a></li>
	</ul>
</nav>

{@render children()}
