<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { confirmVariant } from '@tran/core/budget';
	import { AlertDialog, Button, announce } from './platform-ui';
	import {
		CONFIRM_TITLE,
		confirmBodyA,
		confirmBodyB,
		facts,
		NOT_NOW,
		NOTHING_SPENT,
		SPEND_ANYWAY,
		SPENDING
	} from './copy/cap';

	// Per-call over-cap confirmation (UI-SPEC CapConfirmDialog, DATA-03). Caller-owned: no trigger
	// inside, so a settled call cannot unmount it mid-close. It holds no memory: every over-cap call
	// opens it again (the single-use grant lives in the gateway). No native browser prompt is used.
	// - Initial focus is Not now; Escape cancels; the overlay never closes it.
	// - While the call runs, both buttons are disabled and Escape is ignored. The dialog closes when
	//   the call settles; `onConfirm` renders its own result (or error) where the action's result goes.

	interface Props {
		open?: boolean;
		/** Billed calls this month before this one. */
		used: number;
		cap: number;
		onConfirm: () => Promise<void>;
		onCancel: () => void;
		/** bits-ui close auto-focus hook: call `e.preventDefault()` and focus elsewhere to override. */
		onCloseAutoFocus?: (e: Event) => void;
	}

	let {
		open = $bindable(false),
		used,
		cap,
		onConfirm,
		onCancel,
		onCloseAutoFocus
	}: Props = $props();

	let pending = $state(false);
	let cancelEl = $state<HTMLElement | null>(null);

	const pastPlan = $derived(confirmVariant(used) === 'past-plan');
	const body = $derived(pastPlan ? confirmBodyB(used) : confirmBodyA(cap, used));
	const rows = $derived(facts(used, cap));

	function cancel(): void {
		if (pending) return;
		open = false;
		announce(NOTHING_SPENT);
		onCancel();
	}

	async function spend(): Promise<void> {
		if (pending) return;
		pending = true;
		try {
			await onConfirm();
		} catch {
			// The caller's onConfirm owns error rendering; the dialog only closes once the call settles.
		} finally {
			pending = false;
			open = false;
		}
	}

	function onEscapeKeydown(e: KeyboardEvent): void {
		// Prevent bits-ui's own close so cancel() is the single path (and pending ignores Escape).
		e.preventDefault();
		cancel();
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			cancelEl?.focus();
		}}
		{onCloseAutoFocus}
		{onEscapeKeydown}
		interactOutsideBehavior="ignore"
	>
		<AlertDialog.Title>{CONFIRM_TITLE}</AlertDialog.Title>
		<AlertDialog.Description class="text-body text-foreground">{body}</AlertDialog.Description>
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
				disabled={pending}
				aria-disabled={pending ? 'true' : undefined}
				onclick={cancel}
			>
				{NOT_NOW}
			</Button>
			<Button
				variant={pastPlan ? 'destructive' : 'default'}
				disabled={pending}
				aria-disabled={pending ? 'true' : undefined}
				onclick={spend}
			>
				{#if pending}
					<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
					{SPENDING}
				{:else}
					{SPEND_ANYWAY}
				{/if}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
