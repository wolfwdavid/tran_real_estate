<script lang="ts">
	import { tick } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { matchesOverageWord } from '@tran/core/budget';
	import { AlertDialog, Button, Input, Label } from './platform-ui';
	import {
		ABOVE_TITLE,
		aboveBody,
		keepCap,
		SAVING,
		setCap,
		TYPE_LABEL,
		typeError
	} from './copy/cap';

	// Typed confirmation for a cap above RentCast's 50-call plan (UI-SPEC CapAboveLimitDialog). Every
	// call past 50 can be billed, so the user types "overage" (case-insensitive, trimmed). The confirm
	// button stays enabled: a miss shows the field error instead of a silently disabled button.
	// Caller-owned (no trigger); initial focus is Keep cap; Escape cancels; outside clicks are ignored.

	interface Props {
		open?: boolean;
		/** The cap being authorized (51..1,000). */
		value: number;
		/** The saved cap the user keeps by cancelling. */
		oldCap: number;
		onConfirm: () => Promise<void>;
		onCancel: () => void;
		/** bits-ui close auto-focus hook: call `e.preventDefault()` and focus elsewhere to override. */
		onCloseAutoFocus?: (e: Event) => void;
	}

	let {
		open = $bindable(false),
		value,
		oldCap,
		onConfirm,
		onCancel,
		onCloseAutoFocus
	}: Props = $props();

	const uid = $props.id();
	const inputId = `${uid}-overage`;
	const errorId = `${uid}-overage-error`;

	let word = $state('');
	let error = $state('');
	let pending = $state(false);
	let cancelEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

	function reset(): void {
		word = '';
		error = '';
	}

	function cancel(): void {
		if (pending) return;
		open = false;
		reset();
		onCancel();
	}

	async function submit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (pending) return;
		if (!matchesOverageWord(word)) {
			error = typeError(oldCap);
			await tick();
			inputEl?.focus();
			return;
		}
		error = '';
		pending = true;
		try {
			await onConfirm();
		} catch {
			// The caller's onConfirm owns error rendering; the dialog closes once the save settles.
		} finally {
			pending = false;
			open = false;
			reset();
		}
	}

	function onEscapeKeydown(e: KeyboardEvent): void {
		// cancel() is the single close path; it ignores Escape while a save is in flight.
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
		<AlertDialog.Title>{ABOVE_TITLE}</AlertDialog.Title>
		<AlertDialog.Description class="text-body text-foreground">
			{aboveBody(value)}
		</AlertDialog.Description>
		<form class="grid gap-4" novalidate onsubmit={submit}>
			<div class="grid gap-2">
				<Label for={inputId} class="text-body font-semibold">{TYPE_LABEL}</Label>
				<Input
					id={inputId}
					bind:ref={inputEl}
					bind:value={word}
					type="text"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					aria-invalid={error ? 'true' : undefined}
					aria-describedby={error ? errorId : undefined}
					disabled={pending}
				/>
				{#if error}
					<p id={errorId} class="flex items-center gap-1 text-label text-destructive">
						<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
						{error}
					</p>
				{/if}
			</div>
			<AlertDialog.Footer class="mt-2">
				<Button
					bind:ref={cancelEl}
					variant="outline"
					disabled={pending}
					aria-disabled={pending ? 'true' : undefined}
					onclick={cancel}
				>
					{keepCap(oldCap)}
				</Button>
				<Button
					type="submit"
					variant="destructive"
					disabled={pending}
					aria-disabled={pending ? 'true' : undefined}
				>
					{#if pending}
						<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
						{SAVING}
					{:else}
						{setCap(value)}
					{/if}
				</Button>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
