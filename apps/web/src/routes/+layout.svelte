<script lang="ts">
	import '@fontsource-variable/fraunces';
	import '@fontsource-variable/inter';
	import '../app.css';

	let { children } = $props();
</script>

<a href="#main-content">Skip to content</a>
<main id="main-content">
	{@render children()}
</main>
