<script lang="ts">
	// 05-UI-SPEC "ProviderChip". Sample variant: the exact visual of Phase 4's ProvenanceChip
	// "Sample data" chip (same classes and FlaskConical icon), labelled "Sample output". Phase 4's
	// chip takes a data Provenance and a fixed label, so it is mirrored here rather than wrapped.
	// Live variant: "{Provider} · {model}" on surface, muted-foreground text, Cpu 14px.
	// A non-interactive <span>: the text carries the full meaning.
	import Cpu from '@lucide/svelte/icons/cpu';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';

	let {
		kind,
		providerLabel = '',
		model = ''
	}: { kind: 'live' | 'sample'; providerLabel?: string; model?: string } = $props();

	const BASE =
		'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-label font-semibold';
	const VARIANT = {
		sample: 'whitespace-nowrap border-border-strong bg-accent-surface text-foreground',
		live: 'border-transparent bg-surface text-muted-foreground'
	} as const;
</script>

<span data-provider-chip={kind} class="{BASE} {VARIANT[kind]}">
	{#if kind === 'sample'}
		<FlaskConical class="size-3.5 shrink-0" aria-hidden="true" />
		Sample output
	{:else}
		<Cpu class="size-3.5 shrink-0" aria-hidden="true" />
		<span>{providerLabel} · <code class="[overflow-wrap:anywhere]">{model}</code></span>
	{/if}
</span>
