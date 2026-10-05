<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { AlertDialog, Button, announce } from './platform-ui';
	import CostLabel from './CostLabel.svelte';
	import {
		DUE_BODY,
		DUE_DECLINED,
		DUE_LIST_MAX,
		DUE_NOT_NOW,
		checkLabel,
		checking,
		dueFactRows,
		dueOverflow,
		duePartial,
		dueTitle
	} from './copy/source';

	// Confirm before the alerts scheduler checks more than 3 due saved searches (04-UI-SPEC
	// DueSearchesDialog, DATA-03). Caller-owned and props-driven: the scheduler decides which run
	// (oldest first, never past the cap) and reports `progress`; this only asks.
	// - Initial focus is Not now; Escape declines; the overlay never closes it.
	// - While checking, both buttons are disabled, Escape is ignored and focus stays in the dialog.
	// - It opens on app load with no trigger, so focus returns to <main> on close.

	interface Props {
		open?: boolean;
		/** Names of the due searches, oldest first. */
		names: string[];
		/** How many searches are due. */
		dueCount: number;
		/** How many fit under the cap and will run. */
		runCount: number;
		/** Calls the run uses (searches sharing a cache key share a call). */
		calls: number;
		used: number;
		cap: number;
		progress: { i: number; k: number } | null;
		onConfirm: () => Promise<void>;
		onDecline: () => void;
	}

	let {
		open = $bindable(false),
		names,
		dueCount,
		runCount,
		calls,
		used,
		cap,
		progress,
		onConfirm,
		onDecline
	}: Props = $props();

	let pending = $state(false);
	let cancelEl = $state<HTMLElement | null>(null);
	let contentEl = $state<HTMLElement | null>(null);

	const busy = $derived(pending || progress !== null);
	const shown = $derived(names.slice(0, DUE_LIST_MAX));
	const more = $derived(Math.max(names.length - DUE_LIST_MAX, 0));
	const rows = $derived(dueFactRows(calls, used, cap));

	// Disabling the focused button would drop focus to <body>; keep it on the dialog instead.
	$effect(() => {
		if (busy && contentEl && !contentEl.contains(document.activeElement)) contentEl.focus();
	});

	function decline(): void {
		if (busy) return;
		open = false;
		announce(DUE_DECLINED);
		onDecline();
	}

	async function confirm(): Promise<void> {
		if (busy) return;
		pending = true;
		contentEl?.focus();
		try {
			await onConfirm();
		} catch {
			// The caller owns error rendering; the dialog only closes once the run settles.
		} finally {
			pending = false;
			open = false;
		}
	}

	function onEscapeKeydown(e: KeyboardEvent): void {
		e.preventDefault();
		decline();
	}

	function onCloseAutoFocus(e: Event): void {
		const main = document.querySelector<HTMLElement>('main');
		if (!main) return;
		e.preventDefault();
		main.focus();
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content
		bind:ref={contentEl}
		tabindex={-1}
		aria-busy={busy ? 'true' : undefined}
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			cancelEl?.focus();
		}}
		{onCloseAutoFocus}
		{onEscapeKeydown}
		interactOutsideBehavior="ignore"
	>
		<AlertDialog.Title>{dueTitle(dueCount)}</AlertDialog.Title>
		<AlertDialog.Description class="grid gap-2 text-body text-foreground">
			<span class="block">{DUE_BODY}</span>
			{#if runCount < dueCount}
				<span class="block">{duePartial(runCount)}</span>
			{/if}
		</AlertDialog.Description>
		<ul class="grid list-disc gap-1 pl-6 text-body text-foreground">
			{#each shown as name, index (index)}
				<li>{name}</li>
			{/each}
		</ul>
		{#if more > 0}
			<p class="text-body text-muted-foreground tabular-nums">{dueOverflow(more)}</p>
		{/if}
		<dl class="grid gap-1 text-body text-foreground tabular-nums">
			{#each rows as row (row.term)}
				<div class="flex flex-wrap gap-1">
					<dt>{row.term}:</dt>
					<dd class="font-semibold">{row.value}</dd>
				</div>
			{/each}
		</dl>
		<AlertDialog.Footer class="mt-2">
			<Button
				bind:ref={cancelEl}
				variant="outline"
				disabled={busy}
				aria-disabled={busy ? 'true' : undefined}
				onclick={decline}
			>
				{DUE_NOT_NOW}
			</Button>
			<Button
				variant="default"
				disabled={busy}
				aria-disabled={busy ? 'true' : undefined}
				onclick={confirm}
			>
				{#if progress}
					<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
					{checking(progress.i, progress.k)}
				{:else}
					{checkLabel(runCount)}
					<CostLabel estimate={{ calls, reason: 'network' }} />
				{/if}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
