<script lang="ts">
	import { getSettingsContext } from './settings-context.svelte';

	// Stub: 03-13 replaces the body (export, import preview, backup reminder).
	const ctx = getSettingsContext();
</script>

<section id="backup" aria-labelledby="backup-heading">
	<h2 id="backup-heading" tabindex="-1" class="font-display text-heading font-semibold">
		Backup and restore
	</h2>
	<p class="mt-4 text-body">
		Tran keeps your data only in this browser. A backup file is your copy if the browser clears it
		or you switch devices. Backups never include your API keys.
	</p>
	{#if !ctx.ready}
		<p class="mt-4 text-label text-muted-foreground">Checking this browser…</p>
	{/if}
</section>
