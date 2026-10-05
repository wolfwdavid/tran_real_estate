<script lang="ts">
	import { tick, untrack } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { validateCap } from '@tran/core/budget';
	import { Button, Input, Label, announce } from './platform-ui';
	import CapAboveLimitDialog from './CapAboveLimitDialog.svelte';
	import {
		belowUsage,
		CAP_ERRORS,
		CAP_LABEL,
		CAP_SUFFIX,
		capSaved,
		HELPER_ABOVE,
		helperWithin,
		SAVE_CAP,
		SAVE_FAILED,
		SAVING
	} from './copy/cap';

	// Monthly call cap form (UI-SPEC CapEditor, DATA-03). Validation runs on submit only, through
	// @tran/core/budget validateCap: 1-50 save directly, 51-1,000 go through CapAboveLimitDialog
	// (typed "overage"). After Save cap focus stays on the button and the result is announced; after
	// a failed save focus moves to the input. The caller persists the cap (writeCap) in `onSave`
	// and owns cross-tab broadcast; this form holds no other state.

	interface Props {
		/** The saved cap (prefills the input). */
		cap: number;
		/** Billed calls this month. */
		used: number;
		/** Persists the cap. Rejecting shows the save-failed line. */
		onSave: (cap: number) => Promise<void>;
	}

	let { cap, used, onSave }: Props = $props();

	const uid = $props.id();
	const inputId = `${uid}-cap`;
	const helperId = `${uid}-cap-helper`;
	const errorId = `${uid}-cap-error`;

	let text = $state(untrack(() => String(cap)));
	let invalid = $state<string | null>(null);
	let failed = $state(false);
	let saved = $state<{ value: number; below: boolean } | null>(null);
	let pending = $state(false);
	let dialogOpen = $state(false);
	let dialogValue = $state(0);
	let dialogSaved: boolean | null = null;

	let inputEl = $state<HTMLInputElement | null>(null);
	let buttonEl = $state<HTMLButtonElement | null>(null);

	const helper = $derived.by(() => {
		const v = validateCap(text);
		if (v.ok) return v.aboveLimit ? HELPER_ABOVE : helperWithin(v.value);
		return helperWithin(cap);
	});
	const errorText = $derived(invalid ?? (failed ? SAVE_FAILED : null));

	/** Persists `value`; returns whether it succeeded. Never throws. */
	async function save(value: number): Promise<boolean> {
		pending = true;
		saved = null;
		failed = false;
		try {
			await onSave(value);
			saved = { value, below: used > 0 && used >= value };
			announce(capSaved(value));
			return true;
		} catch {
			failed = true;
			return false;
		} finally {
			pending = false;
		}
	}

	async function submit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (pending) return;
		saved = null;
		failed = false;
		const v = validateCap(text);
		if (!v.ok) {
			invalid = CAP_ERRORS[v.error];
			await tick();
			inputEl?.focus();
			return;
		}
		invalid = null;
		if (v.aboveLimit) {
			dialogValue = v.value;
			dialogSaved = null;
			dialogOpen = true;
			return;
		}
		if (!(await save(v.value))) {
			await tick();
			inputEl?.focus();
		}
	}

	async function confirmAbove(): Promise<void> {
		dialogSaved = await save(dialogValue);
	}

	function onDialogCloseAutoFocus(e: Event): void {
		// Cancelled or saved: back to Save cap (the trigger). Failed save: the cap input.
		e.preventDefault();
		const target = dialogSaved === false ? inputEl : buttonEl;
		dialogSaved = null;
		void tick().then(() => target?.focus());
	}
</script>

<form class="grid gap-2" novalidate onsubmit={submit}>
	<Label for={inputId} class="text-body font-semibold">{CAP_LABEL}</Label>
	<div class="flex flex-wrap items-center gap-x-2 gap-y-3">
		<div class="flex items-center gap-2">
			<Input
				id={inputId}
				bind:ref={inputEl}
				bind:value={text}
				type="text"
				inputmode="numeric"
				pattern="[0-9]*"
				autocomplete="off"
				class="w-24 tabular-nums"
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={errorText ? `${helperId} ${errorId}` : helperId}
			/>
			<span class="text-body text-foreground">{CAP_SUFFIX}</span>
		</div>
		<Button
			type="submit"
			bind:ref={buttonEl}
			class="w-full sm:ml-2 sm:w-auto"
			aria-disabled={pending ? 'true' : undefined}
		>
			{#if pending}
				<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
				{SAVING}
			{:else}
				{SAVE_CAP}
			{/if}
		</Button>
	</div>
	<p id={helperId} class="text-label text-muted-foreground">{helper}</p>
	{#if errorText}
		<p id={errorId} class="flex items-center gap-1 text-label text-destructive">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
			{errorText}
		</p>
	{/if}
	{#if saved}
		<p class="flex items-start gap-1 text-label text-foreground">
			<CircleCheck class="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
			<span>
				<span>{capSaved(saved.value)}</span>
				{#if saved.below}
					<span>{belowUsage(used)}</span>
				{/if}
			</span>
		</p>
	{/if}
</form>

<CapAboveLimitDialog
	bind:open={dialogOpen}
	value={dialogValue}
	oldCap={cap}
	onConfirm={confirmAbove}
	onCancel={() => {}}
	onCloseAutoFocus={onDialogCloseAutoFocus}
/>
