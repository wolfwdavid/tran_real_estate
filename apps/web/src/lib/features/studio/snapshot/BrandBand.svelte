<script lang="ts" module>
	import { effectiveBrandColors } from '$lib/features/shared/agent-profile';

	const HEX6 = /^#[0-9A-Fa-f]{6}$/;

	/**
	 * The two report brand colors, re-validated at render time (defense in depth: the record was
	 * built from effective colors, but a backup import could carry anything). Only a strict
	 * #RRGGBB reaches effectiveBrandColors; anything else, or a color failing its contrast check,
	 * becomes the Tran token. The result is always an upper-case #RRGGBB.
	 */
	export function bandColors(agent: { brandPrimary: string; brandAccent: string }): {
		primary: string;
		accent: string;
	} {
		const strict = (v: string) => (typeof v === 'string' && HEX6.test(v) ? v : '');
		const eff = effectiveBrandColors({
			brandPrimary: strict(agent.brandPrimary),
			brandAccent: strict(agent.brandAccent)
		});
		const fallback = effectiveBrandColors({});
		const safe = (v: string, f: string) => (HEX6.test(v) ? v : f).toUpperCase();
		return {
			primary: safe(eff.primary, fallback.primary),
			accent: safe(eff.accent, fallback.accent)
		};
	}
</script>

<script lang="ts">
	// 09-UI-SPEC "Market Snapshot print" item 1: the agent's brand band at the top of the sheet.
	// Agent colors appear only here (the fill and the 4px rule) and in the report h1; both come from
	// bandColors(), set as custom properties through style: directives (CSSOM, CSP-safe). The text
	// is espresso on the accent, which effectiveBrandColors keeps at >= 4.5:1, so the band
	// reads whether or not the fill prints. Prominence (RES A.4): the brokerage line is Heading
	// 24/600, the agent line Body 16/600.
	import { brokerageLine } from '@tran/core/studio';
	import type { SnapshotAgent } from '$lib/storage/studio/types';

	let { agent, logoUrl = null }: { agent: SnapshotAgent; logoUrl?: string | null } = $props();

	const colors = $derived(bandColors(agent));
	const d = $derived(agent.disclosure);
	const brokerage = $derived(brokerageLine(d));
	const agentLine = $derived([d.fullName.trim(), d.licenseType.trim()].filter(Boolean).join(', '));
	const alt = $derived(`${d.brokerage.trim() || d.fullName.trim() || 'Agent'} logo`);
</script>

<div
	class="brand-band flex w-full flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center"
	data-brand-band
	style:--brand-primary-effective={colors.primary}
	style:--brand-accent-effective={colors.accent}
>
	{#if logoUrl}
		<img src={logoUrl} {alt} class="max-h-16 max-w-40 shrink-0 object-contain" data-brand-logo />
	{/if}
	<div class="flex min-w-0 flex-col gap-1">
		{#if brokerage}
			<p
				class="font-display text-heading font-semibold break-words text-foreground"
				data-band-brokerage
			>
				{brokerage}
			</p>
		{/if}
		{#if agentLine}
			<p class="text-base leading-[1.6] font-semibold break-words text-foreground" data-band-agent>
				{agentLine}
			</p>
		{/if}
	</div>
</div>

<style>
	.brand-band {
		background-color: var(--brand-accent-effective);
		border-bottom: 4px solid var(--brand-primary-effective);
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}
</style>
