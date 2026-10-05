<script lang="ts">
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	// Tiny and browser-safe at import time (no vault, no Dexie).
	import { requestPersistence } from '$lib/storage/persistence';
	import SectionError from './SectionError.svelte';
	import { getSettingsContext } from './settings-context.svelte';

	// "Where to keep your keys": applies immediately (no Save), the vault migrates the keys, and the
	// change is announced. Remember → This tab only needs no confirmation: the keys stay for this tab.
	const ctx = getSettingsContext();

	type Mode = 'session' | 'remember';
	const OPTIONS: { value: Mode; title: string; description: string }[] = [
		{
			value: 'session',
			title: 'This tab only (default)',
			description: "Keys are cleared when you close this tab. You'll paste them again next time."
		},
		{
			value: 'remember',
			title: 'Remember on this device',
			description:
				'Keys stay in this browser after you close it. Anyone who uses this browser profile could use them, so add a passphrase on a shared computer.'
		}
	];

	let selected = $state<Mode>('session');
	let busy = $state(false);
	let blocked = $state(false);

	// Follow the vault (including changes made in another tab) whenever no switch is in flight.
	$effect(() => {
		const mode = ctx.vaultStatus?.mode;
		if (mode && !busy) selected = mode;
	});

	function codeOf(err: unknown): string | undefined {
		return err instanceof Error && 'code' in err ? String(err.code) : undefined;
	}

	function onValueChange(value: string): void {
		const vault = ctx.vault;
		if (!vault || (value !== 'session' && value !== 'remember')) return;
		const previous = ctx.vaultStatus?.mode ?? 'session';
		if (value === previous) return;
		// Firefox honours persist() only with user activation: call it before any await.
		if (value === 'remember') void requestPersistence();
		busy = true;
		blocked = false;
		void vault
			.setMode(value)
			.then(() => {
				announce(
					value === 'remember'
						? 'Keys will be remembered on this device.'
						: "Keys removed from this device's storage. They'll stay available until you close this tab."
				);
			})
			.catch((err: unknown) => {
				selected = previous;
				const code = codeOf(err);
				if (code === 'vault-locked') {
					announce('Unlock your keys in Key security to use or change this key.');
					document.getElementById('unlock-passphrase')?.focus();
				} else if (code === 'storage-blocked') {
					blocked = true;
				} else {
					announce("Couldn't change where your keys are kept. Try again.");
				}
			})
			.finally(() => {
				busy = false;
			});
	}
</script>

<fieldset class="grid gap-2">
	<legend class="mb-2 text-body font-semibold">Where to keep your keys</legend>
	<RadioGroup.Root bind:value={selected} {onValueChange} class="grid gap-2" aria-busy={busy}>
		{#each OPTIONS as option (option.value)}
			{@const disabled = busy || (option.value === 'remember' && ctx.storageBlocked)}
			<label
				class="flex min-h-11 cursor-pointer touch-manipulation items-start gap-3 py-2 has-disabled:cursor-not-allowed"
			>
				<RadioGroup.Item
					value={option.value}
					{disabled}
					aria-labelledby="key-mode-{option.value}-title"
					aria-describedby="key-mode-{option.value}-description"
					class="mt-0.5"
				/>
				<span class="grid gap-1">
					<span id="key-mode-{option.value}-title" class="text-body font-semibold">
						{option.title}
					</span>
					<span id="key-mode-{option.value}-description" class="text-body text-muted-foreground">
						{option.description}
					</span>
				</span>
			</label>
		{/each}
	</RadioGroup.Root>
</fieldset>

{#if blocked}
	<SectionError
		title="This browser is blocking site storage"
		body="Tran can't save keys or data beyond this tab. Allow cookies and site data for this site, or leave private browsing, then reload the page."
		focusOnMount
		class="mt-4"
	/>
{/if}
