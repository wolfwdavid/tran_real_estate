<script lang="ts">
	import RenterNav from '$lib/features/renter/RenterNav.svelte';

	let { children } = $props();
</script>

<!-- Renders inside the (app) layout's <main>, after the Data source status bar and AppNotice. -->
<RenterNav />
{@render children()}
