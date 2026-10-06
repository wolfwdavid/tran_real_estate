<script lang="ts">
	// One persistent status line per page region: the last reversible change plus an inline Undo.
	// Replaced by the next change and cleared on navigation by the owner; never auto-dismisses.
	// tabindex="-1" lets the owner move focus here after a change made from a closing menu.
	import CircleCheck from '@lucide/svelte/icons/circle-check';

	let { message, onundo, id }: { message: string | null; onundo?: () => void; id?: string } =
		$props();
</script>

{#if message !== null}
	<p
		{id}
		tabindex="-1"
		data-undo-status
		class="inline-flex flex-wrap items-center gap-2 text-label text-foreground"
	>
		<CircleCheck size={16} class="shrink-0 text-secondary" aria-hidden="true" />
		<span>{message}</span>
		{#if onundo}
			<button
				type="button"
				class="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center px-2 font-semibold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				onclick={onundo}>Undo</button
			>
		{/if}
	</p>
{/if}
