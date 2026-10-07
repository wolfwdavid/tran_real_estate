<script lang="ts">
	// 09-UI-SPEC "CharacterCount": the count line under an output. The caller counts with
	// text.length (UTF-16 code units, conservative for emoji) and builds the visible line.
	// Over the limit: TriangleAlert plus words in Label 14/600 foreground, never color alone and
	// never destructive (nothing failed; the text just needs shortening). Not a live region:
	// counts are never announced as they change.
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let {
		length,
		limit,
		overText,
		text
	}: { length: number; limit?: number; overText?: string; text: string } = $props();

	const over = $derived(limit !== undefined && length > limit);
</script>

{#if over}
	<p
		class="flex items-start gap-2 text-label font-semibold text-foreground tabular-nums"
		data-char-count="over"
	>
		<TriangleAlert size={16} class="mt-0.5 shrink-0 text-foreground" aria-hidden="true" />
		<span>{overText ?? text}</span>
	</p>
{:else}
	<p class="text-label text-muted-foreground tabular-nums" data-char-count="within">{text}</p>
{/if}
