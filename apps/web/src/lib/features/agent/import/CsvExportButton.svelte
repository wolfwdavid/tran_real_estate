<script lang="ts">
	// UI-SPEC "CSV export" (AGT-07): one click downloads tran-contacts-YYYY-MM-DD.csv of the agent's
	// own contacts (samples excluded) through the Phase 3 object-URL mechanism. No dialog. With
	// nothing to export, nothing downloads and the empty line is shown and announced. Reads this
	// browser's IndexedDB at click time; no network.
	import Download from '@lucide/svelte/icons/download';
	import { Button, announce } from '$lib/features/shared/data/platform-ui';
	import { listContacts } from '$lib/storage/agent/contacts-repo';
	import { todayLocal } from '../dates';
	import { buildExport, downloadText } from './csv-export';

	const EMPTY = 'There are no contacts of yours to export yet.';
	const HELPER =
		"Includes contact details, stage, and notes. Tasks and activity are in your Tran backup. Sample contacts aren't included.";

	let pending = $state(false);
	let empty = $state(false);

	async function exportCsv() {
		if (pending) return;
		pending = true;
		try {
			const out = buildExport(await listContacts(), todayLocal());
			if (out === null) {
				empty = true;
				announce(EMPTY);
				return;
			}
			empty = false;
			downloadText(out.filename, out.text);
			announce(`Downloaded ${out.filename}.`);
		} finally {
			pending = false;
		}
	}
</script>

<div class="flex max-w-sm flex-col gap-1" data-csv-export>
	<Button variant="outline" class="min-h-11 self-start" disabled={pending} onclick={exportCsv}>
		<Download size={16} aria-hidden="true" />
		Export contacts (CSV)
	</Button>
	<p class="text-label text-muted-foreground">{HELPER}</p>
	{#if empty}
		<p class="text-label text-foreground" data-csv-export-empty>{EMPTY}</p>
	{/if}
</div>
