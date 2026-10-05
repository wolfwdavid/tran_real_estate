<script lang="ts">
	import '@fontsource-variable/fraunces';
	import '@fontsource-variable/inter';
	import '../app.css';
	import SkipLink from '$lib/components/layout/SkipLink.svelte';

	let { children } = $props();
</script>

<SkipLink />
{@render children()}
