<script lang="ts">
	// /agent/import/ (UI-SPEC "Import page"; AGT-03, AGT-07). Three ways in: paste a lead email,
	// choose a CSV file, or add one lead by hand. Both imports run a dry-run review and commit in
	// one transaction; everything stays in this browser.
	import QuickAddDialog from '$lib/features/agent/crm/QuickAddDialog.svelte';
	import CsvImport from '$lib/features/agent/import/CsvImport.svelte';
	import PasteImport from '$lib/features/agent/import/PasteImport.svelte';
	import { Button } from '$lib/features/shared/data/platform-ui';

	let addOpen = $state(false);
	let h1El = $state<HTMLHeadingElement | null>(null);
</script>

<svelte:head>
	<title>Import leads: Agent portal &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Bring leads in by pasting a lead email or choosing a CSV file. Nothing leaves this browser."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<h1
			bind:this={h1El}
			tabindex="-1"
			class="font-display text-display font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			Import leads
		</h1>
		<Button variant="ghost" class="min-h-11" onclick={() => (addOpen = true)}>
			Add one lead by hand
		</Button>
	</div>
	<p class="mt-4 max-w-[640px] text-base leading-[1.6]">
		Bring in leads from your inquiry page emails, a spreadsheet, or one at a time. Everything stays
		in this browser.
	</p>

	<div class="mt-12 grid gap-12 md:mt-16 md:gap-16">
		<PasteImport onaddlead={() => (addOpen = true)} />
		<CsvImport />
	</div>

	<QuickAddDialog bind:open={addOpen} onadded={() => h1El?.focus()} />
</div>
