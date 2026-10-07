<script lang="ts">
	// "Preview" (UI-SPEC BrandPreview, AGT-01): a mini report header drawn with the EFFECTIVE brand
	// colors, so a failing color is already replaced by Tran's terracotta / sand here. The only
	// inline style sets the two custom properties, and their values are always a validated
	// #RRGGBB from effectiveBrandColors() or a Tran token; nothing else from user input reaches a
	// style attribute. Phase 9 reports reuse the same function and logoObjectUrl(). Lives in
	// features/shared/agent-profile so the Studio can render it without importing the agent CRM folder.
	import type { ProfileInput } from '@tran/core/agent/types';
	import { composeDisclosure } from '@tran/core/disclosure';
	import { effectiveBrandColors } from '@tran/brand/brand-color';
	import { logoObjectUrl } from './logo-url';

	let { profile }: { profile: ProfileInput } = $props();

	const eff = $derived(effectiveBrandColors(profile));
	const agentName = $derived(profile.name.trim() || 'Your name');
	const alt = $derived(`${profile.brokerage.trim() || profile.name.trim() || 'Your'} logo`);
	const disclosure = $derived(composeDisclosure(profile, 'print').lines[0] ?? '');

	let url = $state<string | null>(null);
	$effect(() => {
		const logo = profile.logo;
		if (!logo) {
			url = null;
			return;
		}
		const next = logoObjectUrl(logo);
		url = next;
		return () => URL.revokeObjectURL(next);
	});
</script>

<section aria-labelledby="brand-preview-title" class="flex min-w-0 flex-col gap-4">
	<h2 id="brand-preview-title" class="text-base leading-[1.6] font-semibold text-foreground">
		Preview
	</h2>
	<div
		data-testid="brand-preview"
		class="w-full max-w-[320px] overflow-hidden rounded-md border border-border bg-card"
		style="--brand-primary: {eff.primary}; --brand-accent: {eff.accent}"
	>
		<div class="flex items-center gap-3 bg-[var(--brand-accent)] px-4 py-3">
			{#if url}
				<img src={url} {alt} class="max-h-12 max-w-[120px] shrink-0 object-contain" />
			{/if}
			<p class="min-w-0 truncate text-body font-semibold text-foreground">{agentName}</p>
		</div>
		<div class="h-1 bg-[var(--brand-primary)]" aria-hidden="true"></div>
		<div class="flex flex-col gap-3 p-4">
			<span
				class="inline-flex w-fit items-center rounded-md bg-[var(--brand-primary)] px-4 py-2 text-label font-semibold text-white"
			>
				Contact me
			</span>
			{#if disclosure}
				<p class="text-label break-words text-muted-foreground">{disclosure}</p>
			{/if}
		</div>
	</div>
	<p class="text-label text-muted-foreground">
		How your colors and logo will look on reports you create in the Studio.
	</p>
</section>
