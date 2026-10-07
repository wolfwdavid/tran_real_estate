<script lang="ts">
	// Test-only wrapper: ImportPreview reads the Settings context, which only the Settings page
	// provides. The kit is never called while rendering, so an empty stand-in is enough.
	import ImportPreview from '../ImportPreview.svelte';
	import type { BackupKit } from '../BackupSection.svelte';
	import { createSettingsContext, setSettingsContext } from '../settings-context.svelte';
	import type { ImportPreview as Preview } from '$lib/storage/backup';

	let { preview }: { preview: Preview } = $props();

	setSettingsContext(createSettingsContext());
	const kit = {} as BackupKit;
</script>

<ImportPreview {preview} {kit} onClose={() => {}} />
