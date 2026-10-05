<script lang="ts">
	import type { Snippet } from 'svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	// Destructive confirmation (UI-SPEC ConfirmDialog). window.confirm is banned; use this.
	// - Initial focus is Cancel, never the destructive action.
	// - Never closes on an overlay click; Escape is ignored while the action runs.
	// - On success the dialog closes and bits-ui returns focus to the trigger (callers may move it).
	// - On failure the dialog stays open. The error goes to `onError` when given, else it is rethrown.

	interface Props {
		open?: boolean;
		title: string;
		/** One or two paragraphs stating the consequence. */
		body: string[];
		confirmLabel: string;
		confirmBusyLabel: string;
		cancelLabel: string;
		onConfirm: () => Promise<void>;
		onError?: (error: unknown) => void;
		/** Render the caller's trigger Button and spread `props` onto it. */
		trigger: Snippet<[{ props: Record<string, unknown> }]>;
	}

	let {
		open = $bindable(false),
		title,
		body,
		confirmLabel,
		confirmBusyLabel,
		cancelLabel,
		onConfirm,
		onError,
		trigger
	}: Props = $props();

	let busy = $state(false);
	let cancelEl = $state<HTMLElement | null>(null);

	async function runConfirm(): Promise<void> {
		if (busy) return;
		busy = true;
		try {
			await onConfirm();
			open = false;
		} catch (error) {
			if (onError) onError(error);
			else throw error;
		} finally {
			busy = false;
		}
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Trigger>
		{#snippet child({ props })}
			{@render trigger({ props })}
		{/snippet}
	</AlertDialog.Trigger>
	<AlertDialog.Content
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			cancelEl?.focus();
		}}
		escapeKeydownBehavior={busy ? 'ignore' : 'close'}
		interactOutsideBehavior="ignore"
	>
		<AlertDialog.Title>{title}</AlertDialog.Title>
		<AlertDialog.Description class="grid gap-4 text-body text-foreground">
			{#each body as paragraph, i (i)}
				<p>{paragraph}</p>
			{/each}
		</AlertDialog.Description>
		<AlertDialog.Footer class="mt-2">
			<AlertDialog.Cancel
				bind:ref={cancelEl}
				variant="outline"
				disabled={busy}
				aria-disabled={busy ? 'true' : undefined}
			>
				{cancelLabel}
			</AlertDialog.Cancel>
			<Button
				variant="destructive"
				disabled={busy}
				aria-disabled={busy ? 'true' : undefined}
				onclick={runConfirm}
			>
				{#if busy}
					<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
					{confirmBusyLabel}
				{:else}
					{confirmLabel}
				{/if}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
