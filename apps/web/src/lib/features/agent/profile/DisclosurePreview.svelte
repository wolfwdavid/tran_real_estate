<script lang="ts">
	// "Your disclosure" (UI-SPEC DisclosurePreview, AGT-01): the composed line(s) exactly as they are
	// appended, recomputed from the live form draft through the core composer on every change.
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { US_STATES, type ProfileInput } from '@tran/core/agent/types';
	import { PROFILE_FIELD_LABELS, composeDisclosure, ruleFor } from '@tran/core/disclosure';

	let { profile }: { profile: ProfileInput } = $props();

	const result = $derived(composeDisclosure(profile, 'email', { placeholders: true }));

	const stateName = $derived.by(() => {
		const code = profile.licenseState.trim().toUpperCase();
		return US_STATES.find((s) => s.code === code)?.name ?? null;
	});

	const ruleNote = $derived(
		result.rule !== 'generic'
			? `${ruleFor(result.rule).stateName} rule included.`
			: `Tran doesn't have a specific rule for ${stateName ?? 'your state'}, so this uses the general format.`
	);

	function listItems(items: string[]): string {
		if (items.length <= 1) return items.join('');
		return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
	}

	const missingText = $derived(
		listItems(result.missing.map((f) => PROFILE_FIELD_LABELS[f].toLowerCase()))
	);
</script>

<section aria-labelledby="disclosure-preview-title" class="flex min-w-0 flex-col gap-4">
	<h2 id="disclosure-preview-title" class="text-base leading-[1.6] font-semibold text-foreground">
		Your disclosure
	</h2>
	<div class="flex min-w-0 flex-col gap-1" data-testid="disclosure-lines">
		{#each result.lines as line, i (i)}
			<p class="text-base leading-[1.6] break-words text-foreground">{line}</p>
		{/each}
	</div>
	{#if result.warnings.includes('ny-title')}
		<p class="text-label text-foreground">
			New York doesn't allow the title "sales associate" in ads. Choose your licensed title.
		</p>
	{/if}
	{#if result.missing.length > 0}
		<p class="flex items-start gap-2 text-label font-semibold text-foreground">
			<TriangleAlert size={16} class="mt-1 shrink-0" aria-hidden="true" />
			<span>Incomplete: add your {missingText}.</span>
		</p>
	{/if}
	<p class="text-label text-muted-foreground">{ruleNote}</p>
	<p class="text-label text-muted-foreground">
		Added to every follow-up email and report you export. Check it against your state's and
		brokerage's advertising rules; this isn't legal advice.
	</p>
</section>
