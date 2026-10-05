<script lang="ts">
	import PortalSwitcher from './PortalSwitcher.svelte';

	let { showSettings = false }: { showSettings?: boolean } = $props();
</script>

<header class="border-b border-border bg-background">
	<PortalSwitcher {showSettings} />
</header>
