<script lang="ts">
	import { onMount } from 'svelte';
	import { createInstallState } from '$lib/pwa/install.svelte';
	import { getSettingsContext } from './settings-context.svelte';
	import InstallApp from './InstallApp.svelte';

	// The install state reads window, so it is created after hydration (onMount) and disposed on
	// destroy. static/pwa-capture.js has already caught any pre-hydration beforeinstallprompt.
	const ctx = getSettingsContext();
	let install = $state<ReturnType<typeof createInstallState> | null>(null);

	onMount(() => {
		const s = createInstallState();
		install = s;
		return () => s.dispose();
	});
</script>

<section id="install" aria-labelledby="install-heading">
	<h2 id="install-heading" tabindex="-1" class="font-display text-heading font-semibold">
		Install the app
	</h2>
	{#if !ctx.ready || !install}
		<p class="mt-4 text-label text-muted-foreground">Checking this browser…</p>
	{:else}
		<InstallApp {install} />
	{/if}
</section>
