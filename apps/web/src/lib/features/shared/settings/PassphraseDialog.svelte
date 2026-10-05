<script lang="ts">
	import { tick } from 'svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import SecretInput from './SecretInput.svelte';
	import { getSettingsContext } from './settings-context.svelte';

	// Set / change passphrase (UI-SPEC PassphraseDialog). Validation runs on submit only; no strength
	// meter and no composition rules. Every passphrase value is cleared after each attempt.
	// The dialog has no trigger of its own: the caller opens it, because a successful "set" swaps the
	// caller's branch (and would unmount a trigger-owned dialog before it could close cleanly).

	interface Props {
		mode: 'set' | 'change';
		open?: boolean;
		/** Element to focus after closing without a change (normally the opening button). */
		returnFocusId: string;
		/** Element to focus after a successful submit. */
		successFocusId: string;
	}

	let { mode, open = $bindable(false), returnFocusId, successFocusId }: Props = $props();

	const ctx = getSettingsContext();
	const MIN = 12;
	const ID = $derived(`passphrase-${mode}`);

	let current = $state('');
	let next = $state('');
	let confirm = $state('');
	let ack = $state(false);
	let errors = $state<{ current?: string; next?: string; confirm?: string; ack?: string }>({});
	let formError = $state('');
	let busy = $state(false);
	let succeeded = false;

	let currentRef = $state<HTMLInputElement | null>(null);
	let nextRef = $state<HTMLInputElement | null>(null);
	let confirmRef = $state<HTMLInputElement | null>(null);
	let ackRef = $state<HTMLButtonElement | null>(null);

	function clearValues(): void {
		current = '';
		next = '';
		confirm = '';
	}

	function reset(): void {
		clearValues();
		ack = false;
		errors = {};
		formError = '';
	}

	function onOpenChange(value: boolean): void {
		if (!value) reset();
	}

	function onCloseAutoFocus(e: Event): void {
		e.preventDefault();
		const target = succeeded ? successFocusId : returnFocusId;
		succeeded = false;
		void tick().then(() => document.getElementById(target)?.focus());
	}

	async function submit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		const vault = ctx.vault;
		if (busy || !vault) return;
		const cur = current;
		const pass = next;
		const again = confirm;
		clearValues();
		formError = '';

		const found: typeof errors = {};
		if (pass.length < MIN) found.next = 'Use at least 12 characters.';
		if (again !== pass) found.confirm = "The passphrases don't match.";
		if (mode === 'set' && !ack)
			found.ack = 'Check the box to confirm you understand, then try again.';
		errors = found;
		// Focus the first invalid field, in field order.
		const firstInvalid = found.next
			? nextRef
			: found.confirm
				? confirmRef
				: found.ack
					? ackRef
					: null;
		if (firstInvalid) {
			await tick();
			firstInvalid.focus();
			return;
		}

		busy = true;
		try {
			if (mode === 'set') {
				await vault.setPassphrase(pass);
				announce('Passphrase lock added. Your remembered keys are encrypted.');
			} else {
				const result = await vault.changePassphrase(cur, pass);
				if (result === 'wrong') {
					errors = { current: "That isn't your current passphrase." };
					busy = false;
					await tick();
					currentRef?.focus();
					return;
				}
				announce('Passphrase changed.');
			}
			succeeded = true;
			open = false;
			reset();
		} catch (err) {
			const code = err instanceof Error && 'code' in err ? err.code : undefined;
			formError =
				code === 'vault-locked'
					? 'Unlock your keys in Key security to use or change this key.'
					: mode === 'set'
						? "Couldn't add the passphrase in this browser. Try again."
						: "Couldn't change the passphrase in this browser. Try again.";
		} finally {
			busy = false;
		}
	}
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content {onCloseAutoFocus}>
		<Dialog.Header>
			<Dialog.Title>
				{mode === 'set' ? 'Lock your remembered keys' : 'Change your passphrase'}
			</Dialog.Title>
			{#if mode === 'set'}
				<Dialog.Description>
					Choose a passphrase of at least 12 characters. A short sentence you'll remember works
					well.
				</Dialog.Description>
			{/if}
		</Dialog.Header>

		<form class="grid gap-4" novalidate onsubmit={submit}>
			{#if mode === 'change'}
				<SecretInput
					id="{ID}-current"
					label="Current passphrase"
					bind:value={current}
					bind:inputRef={currentRef}
					error={errors.current}
					autocomplete="current-password"
					showLabel="Show passphrase"
				/>
			{/if}
			<SecretInput
				id="{ID}-next"
				label={mode === 'set' ? 'Passphrase' : 'New passphrase'}
				bind:value={next}
				bind:inputRef={nextRef}
				error={errors.next}
				autocomplete="new-password"
				showLabel="Show passphrase"
			/>
			<SecretInput
				id="{ID}-confirm"
				label={mode === 'set' ? 'Confirm passphrase' : 'Confirm new passphrase'}
				bind:value={confirm}
				bind:inputRef={confirmRef}
				error={errors.confirm}
				autocomplete="new-password"
				showLabel="Show passphrase"
			/>
			{#if mode === 'set'}
				<div class="grid gap-2">
					<label class="flex min-h-11 cursor-pointer items-start gap-3 py-2">
						<Checkbox
							bind:ref={ackRef}
							bind:checked={ack}
							aria-describedby={errors.ack ? `${ID}-ack-error` : undefined}
							aria-invalid={errors.ack ? 'true' : undefined}
							class="mt-0.5"
						/>
						<span class="text-body">
							I understand Tran can't recover a forgotten passphrase. If I forget it, I'll need to
							forget my keys and paste them in again.
						</span>
					</label>
					{#if errors.ack}
						<p id="{ID}-ack-error" class="flex items-center gap-1 text-label text-destructive">
							<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
							{errors.ack}
						</p>
					{/if}
				</div>
			{/if}
			{#if formError}
				<p class="flex items-center gap-1 text-label text-destructive">
					<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
					{formError}
				</p>
			{/if}
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={busy} aria-disabled={busy ? 'true' : undefined}>
					{#if busy}
						<LoaderCircle size={16} aria-hidden="true" class="motion-safe:animate-spin" />
						{mode === 'set' ? 'Locking…' : 'Changing…'}
					{:else}
						{mode === 'set' ? 'Lock keys' : 'Change passphrase'}
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
