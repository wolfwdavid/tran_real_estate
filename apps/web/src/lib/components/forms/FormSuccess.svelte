<script lang="ts">
	// Success panel that replaces a sent form (UI-SPEC WaitlistForm/FeedbackForm success). The
	// parent focuses the title (tabindex -1) after it mounts and announces the success string.
	import type { Snippet } from 'svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';

	interface Props {
		title: string;
		body: string;
		titleEl?: HTMLParagraphElement | null;
		children?: Snippet;
	}

	let { title, body, titleEl = $bindable(null), children }: Props = $props();
</script>

<div
	data-form-success
	class="flex gap-3 rounded-lg border-l-4 border-secondary bg-secondary-surface p-4 sm:p-6"
>
	<CircleCheck size={20} class="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
	<div class="grid gap-1">
		<p tabindex="-1" bind:this={titleEl} class="font-semibold">{title}</p>
		<p>{body}</p>
		{#if children}
			<div class="mt-3">{@render children()}</div>
		{/if}
	</div>
</div>
