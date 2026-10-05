<script lang="ts">
	import { tick } from 'svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { Button } from '$lib/components/ui/button/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import ForgetAllDialog from './ForgetAllDialog.svelte';
	import PassphraseDialog from './PassphraseDialog.svelte';
	import SecretInput from './SecretInput.svelte';
	import { getSettingsContext } from './settings-context.svelte';

	// Passphrase lock for remembered keys (UI-SPEC PassphraseLock). Rendered by KeySecuritySection only
	// in remember mode. Three states: no lock, locked (unlock form + cooldown + forgot path), and
	// unlocked with a lock. The passphrase is cleared from state right after every attempt.
	const ctx = getSettingsContext();
	const status = $derived(ctx.vaultStatus);

	const WRONG = "That passphrase didn't unlock your keys. Check it and try again.";
	const HEADING_ID = 'key-security-heading';

	let pass = $state('');
	let error = $state('');
	let busy = $state(false);
	let actionBusy = $state(false);
	let showForgot = $state(false);
	let setOpen = $state(false);
	let changeOpen = $state(false);
	let inputRef = $state<HTMLInputElement | null>(null);
	let input = $state<{ hide: () => void } | null>(null);

	// Cooldown: from the latest unlock result or the persisted status (so a reload still shows it).
	let attemptUntil = $state(0);
	let now = $state(Date.now());
	const cooldownUntil = $derived(Math.max(attemptUntil, status?.cooldownUntil ?? 0));
	const remaining = $derived(Math.max(0, Math.ceil((cooldownUntil - now) / 1000)));
	const cooling = $derived(remaining > 0);

	// Tick once a second while a cooldown runs; announce only its end (the start is announced by the
	// attempt that triggered it). The visible countdown is aria-live="off".
	$effect(() => {
		const until = cooldownUntil;
		if (until <= Date.now()) return;
		now = Date.now();
		const id = setInterval(() => {
			now = Date.now();
			if (now >= until) {
				clearInterval(id);
				announce('You can try your passphrase again.');
			}
		}, 1000);
		return () => clearInterval(id);
	});

	async function focusAfterTick(id: string): Promise<void> {
		await tick();
		document.getElementById(id)?.focus();
	}

	async function unlock(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		const vault = ctx.vault;
		if (busy || cooling || !vault) return;
		const attempt = pass;
		pass = '';
		input?.hide();
		error = '';
		busy = true;
		try {
			const result = await vault.unlock(attempt);
			if (result === 'ok') {
				announce('Keys unlocked.');
				showForgot = false;
				void focusAfterTick(HEADING_ID);
				return;
			}
			error = WRONG;
			if (result !== 'wrong') {
				attemptUntil = result.cooldownUntil;
				now = Date.now();
				const seconds = Math.ceil((result.cooldownUntil - now) / 1000);
				announce(`Too many attempts. Try again in ${seconds} seconds.`);
				return;
			}
			await tick();
			inputRef?.focus();
		} catch {
			error = "Couldn't unlock your keys in this browser. Try again.";
		} finally {
			busy = false;
		}
	}

	async function lockNow(): Promise<void> {
		const vault = ctx.vault;
		if (!vault || actionBusy) return;
		actionBusy = true;
		try {
			await vault.lock();
			announce('Keys locked.');
			void focusAfterTick('unlock-passphrase');
		} finally {
			actionBusy = false;
		}
	}

	async function removePassphrase(): Promise<void> {
		const vault = ctx.vault;
		if (!vault || actionBusy) return;
		actionBusy = true;
		try {
			await vault.removePassphrase();
			announce('Passphrase lock removed. Your keys are still remembered on this device.');
			void focusAfterTick(HEADING_ID);
		} finally {
			actionBusy = false;
		}
	}
</script>

{#if status?.mode === 'remember'}
	<div class="grid gap-4">
		{#if !status.hasLock}
			<p class="text-body">
				Add a passphrase to encrypt your remembered keys. After you reopen Tran, the keys stay
				locked until you enter it.
			</p>
			<div>
				<Button
					id="passphrase-add"
					variant="outline"
					disabled={ctx.storageBlocked}
					onclick={() => (setOpen = true)}
				>
					Add a passphrase
				</Button>
			</div>
		{:else if status.locked}
			<form class="grid gap-4" novalidate onsubmit={unlock}>
				<SecretInput
					bind:this={input}
					id="unlock-passphrase"
					label="Passphrase"
					bind:value={pass}
					bind:inputRef
					error={error || undefined}
					autocomplete="current-password"
					showLabel="Show passphrase"
					disabled={cooling}
				/>
				{#if cooling}
					<p aria-live="off" class="text-body font-semibold">
						Too many attempts. You can try again in {remaining} seconds.
					</p>
				{/if}
				<div>
					<Button
						type="submit"
						disabled={busy || cooling}
						aria-disabled={busy || cooling ? 'true' : undefined}
					>
						{#if busy}
							<LoaderCircle size={16} aria-hidden="true" class="motion-safe:animate-spin" />
							Unlocking…
						{:else}
							Unlock keys
						{/if}
					</Button>
				</div>
			</form>
			<div class="grid gap-2">
				<div>
					<Button
						variant="link"
						class="px-0"
						aria-expanded={showForgot}
						aria-controls="passphrase-forgot"
						onclick={() => (showForgot = !showForgot)}
					>
						Forgot your passphrase?
					</Button>
				</div>
				{#if showForgot}
					<div id="passphrase-forgot" class="grid gap-4">
						<p class="text-body">
							Tran can't reset it, because the passphrase is never stored. To start over, forget all
							keys and paste them in again.
						</p>
						<div>
							<ForgetAllDialog />
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<p class="text-body">
				Your remembered keys are unlocked until you close this tab or lock them.
			</p>
			<div class="flex flex-wrap items-start gap-3">
				<Button variant="outline" disabled={actionBusy} onclick={lockNow}>Lock now</Button>
				<Button
					id="passphrase-change"
					variant="outline"
					disabled={actionBusy}
					onclick={() => (changeOpen = true)}
				>
					Change passphrase
				</Button>
				<div class="grid max-w-60 gap-1">
					<Button
						variant="ghost"
						disabled={actionBusy}
						aria-describedby="passphrase-remove-helper"
						onclick={removePassphrase}
					>
						Remove passphrase
					</Button>
					<p id="passphrase-remove-helper" class="text-label text-muted-foreground">
						Your keys stay remembered on this device, without encryption.
					</p>
				</div>
			</div>
		{/if}
	</div>
{/if}

<PassphraseDialog
	mode="set"
	bind:open={setOpen}
	returnFocusId="passphrase-add"
	successFocusId={HEADING_ID}
/>
<PassphraseDialog
	mode="change"
	bind:open={changeOpen}
	returnFocusId="passphrase-change"
	successFocusId="passphrase-change"
/>
