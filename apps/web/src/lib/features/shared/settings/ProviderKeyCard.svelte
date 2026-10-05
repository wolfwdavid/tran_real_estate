<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { ProviderInfo } from '@tran/core';
	import { Button } from '$lib/components/ui/button/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	// Both modules are tiny and browser-safe at import time (no vault, no Dexie).
	import { getKeyTester, hasKeyTester, type KeyTestResult } from '$lib/storage/secrets/testers';
	import { requestPersistence } from '$lib/storage/persistence';
	import { rentCastKeyTest } from '$lib/data';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import RentCastKeyTestResult from '$lib/features/shared/data/KeyTestResult.svelte';
	import { keyFormatLine, keyTestLine } from '$lib/features/shared/data/copy/source';
	import KeyStatusBadge from './KeyStatusBadge.svelte';
	import SecretInput from './SecretInput.svelte';
	import { getSettingsContext } from './settings-context.svelte';

	// One provider's key card. The raw key lives here only between typing/pasting and Save: it is
	// cleared on every save outcome and never rendered back (the saved summary shows last4 only).
	// Nothing in this file logs, and no key value ever reaches an attribute, URL, error or announcement.

	let { provider }: { provider: ProviderInfo } = $props();

	const ctx = getSettingsContext();

	const id = $derived(provider.id);
	// RentCast (Phase 4): the Test key button carries its cost, the result line is KeyTestResult
	// (from the key-bound rentCastKeyTest record), and a pointer links to RentCast usage.
	const isRentCast = $derived(provider.id === 'rentcast');
	// 04-UI-SPEC card pointer, verbatim; its last words are the inline link to the section.
	const POINTER = 'Usage, cap, and data source are in RentCast usage.';
	const POINTER_LINK = 'RentCast usage';
	const pointerLead = POINTER.slice(0, POINTER.lastIndexOf(POINTER_LINK));
	const entry = $derived(ctx.vaultStatus?.providers[provider.id]);
	const keyState = $derived(entry?.state ?? 'none');
	const isLocked = $derived(Boolean(ctx.vaultStatus?.locked) && keyState === 'locked');
	const isSaved = $derived(keyState === 'session' || keyState === 'remembered');

	let replacing = $state(false);
	let value = $state('');
	let error = $state<string | undefined>(undefined);
	let saving = $state(false);
	let testing = $state(false);
	let testLine = $state<{ ok: boolean; text: string } | null>(null);
	let canPaste = $state(false);
	let inputRef = $state<HTMLInputElement | null>(null);
	let secretInput = $state<SecretInput | null>(null);

	const showForm = $derived(!isLocked && (!isSaved || replacing));

	onMount(() => {
		canPaste = typeof navigator.clipboard?.readText === 'function';
	});

	// A key removed or forgotten elsewhere (another tab, Forget all) closes any open replace form.
	$effect(() => {
		if (!isSaved) replacing = false;
	});

	function resetEntry(): void {
		value = '';
		secretInput?.hide();
	}

	async function focusInput(): Promise<void> {
		await tick();
		inputRef?.focus();
	}

	async function save(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (saving) return;
		const status = ctx.vaultStatus;
		// Firefox honours persist() only with user activation: call it before any await.
		if (status?.mode === 'remember') void requestPersistence();

		const trimmed = value.trim();
		if (trimmed === '') {
			error = 'Paste a key before saving.';
			await focusInput();
			return;
		}
		if (/\s/.test(trimmed)) {
			error = `This key has spaces or line breaks in it. Copy it again from ${provider.label} and paste it here.`;
			await focusInput();
			return;
		}
		const vault = ctx.vault;
		if (!vault) return;

		saving = true;
		error = undefined;
		resetEntry();
		try {
			await vault.setKey(id, trimmed);
			testLine = null;
			replacing = false;
			announce(
				vault.getStatus().mode === 'remember'
					? `${provider.label} key saved and remembered on this device.`
					: `${provider.label} key saved for this tab.`
			);
		} catch (err) {
			error =
				err instanceof Error && 'code' in err && err.code === 'vault-locked'
					? 'Unlock your keys in Key security to use or change this key.'
					: "Couldn't save this key in this browser. Try again.";
			await focusInput();
		} finally {
			saving = false;
		}
	}

	async function paste(): Promise<void> {
		try {
			value = (await navigator.clipboard.readText()).trim();
			error = undefined;
			secretInput?.hide();
		} catch {
			error =
				"Your browser didn't allow reading the clipboard. Paste into the field instead (Ctrl+V, ⌘V, or long-press).";
			await focusInput();
		}
	}

	async function replaceKey(): Promise<void> {
		replacing = true;
		error = undefined;
		testLine = null;
		resetEntry();
		await focusInput();
	}

	async function removeKey(): Promise<void> {
		const vault = ctx.vault;
		if (!vault) return;
		await vault.removeKey(id);
		testLine = null;
		resetEntry();
		announce(`${provider.label} key removed.`);
	}

	function defaultTestMessage(result: KeyTestResult): string {
		switch (result.status) {
			case 'accepted':
				return `${provider.label} accepted this key.`;
			case 'rejected':
				return `${provider.label} didn't accept this key. Check that you copied all of it, or create a new key.`;
			case 'rate-limited':
				return `${provider.label} is limiting requests right now. Wait a minute, then try again.`;
			default:
				return `Couldn't reach ${provider.host}. Check your connection, then try again.`;
		}
	}

	async function testKey(): Promise<void> {
		const tester = getKeyTester(id);
		const vault = ctx.vault;
		if (!tester || !vault || testing) return;
		testing = true;
		testLine = null;
		const controller = new AbortController();
		let result: KeyTestResult;
		try {
			const key = await vault.getKey(id);
			result = key ? await tester(key, controller.signal) : { status: 'failed' };
		} catch {
			result = { status: 'failed' };
		} finally {
			testing = false;
		}
		const record = isRentCast ? rentCastKeyTest.current : null;
		if (record) {
			// KeyTestResult renders the line; announce the same words. Focus stays on the button.
			testLine = null;
			announce(
				record.outcome === 'bad-format'
					? keyFormatLine(record.formatError ?? 'empty')
					: keyTestLine(record.outcome)
			);
			return;
		}
		const text = result.message ?? defaultTestMessage(result);
		testLine = { ok: result.status === 'accepted', text };
		announce(text);
	}
</script>

<article
	id="key-{provider.id}"
	aria-labelledby="key-{provider.id}-name"
	class="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-card"
>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h3 id="key-{provider.id}-name" class="text-body font-semibold">{provider.label}</h3>
		{#if ctx.ready}
			<KeyStatusBadge state={keyState} />
		{/if}
	</div>

	<p class="text-body text-muted-foreground">
		Where this key goes: only from your browser, directly to <code
			class="text-body font-semibold [overflow-wrap:anywhere]">{provider.host}</code
		>.
	</p>

	{#if provider.note}
		<p class="text-body">{provider.note}</p>
	{/if}

	<!-- eslint-disable svelte/no-navigation-without-resolve -- off-site provider console (https keyUrl from @tran/core) -->
	<a
		href={provider.keyUrl}
		class="inline-flex min-h-11 items-center gap-1 self-start text-primary underline underline-offset-3 hover:text-primary-hover"
	>
		Get a {provider.label} key <ExternalLink size={14} aria-hidden="true" /><span class="sr-only"
			>(opens external site)</span
		>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	{#if !ctx.ready}
		<p class="text-label text-muted-foreground">Checking this browser…</p>
	{:else if isLocked}
		<p class="text-body">
			Unlock your keys in Key security to use or change this key. <a
				href="#key-security"
				class="text-primary underline underline-offset-3 hover:text-primary-hover">Key security</a
			>
		</p>
	{:else if showForm}
		<form onsubmit={save} novalidate class="flex flex-col gap-4">
			<SecretInput
				bind:this={secretInput}
				id="key-{provider.id}-input"
				label="{provider.label} API key"
				helper="Paste the whole key. It stays hidden unless you choose Show key."
				autocomplete="off"
				showLabel="Show key"
				digits
				bind:value
				bind:inputRef
				{error}
			/>
			<div class="flex flex-col gap-2 sm:flex-row sm:gap-4">
				{#if canPaste}
					<Button variant="outline" onclick={paste} disabled={saving}>
						<ClipboardPaste size={16} aria-hidden="true" />
						Paste
					</Button>
				{/if}
				<Button type="submit" class="min-w-32" disabled={saving || !ctx.vault}>
					{#if saving}
						<LoaderCircle size={16} aria-hidden="true" class="motion-safe:animate-spin" />
						Saving…
					{:else}
						Save key
					{/if}
				</Button>
			</div>
		</form>
	{:else}
		<p class="flex items-center gap-2 text-body">
			<KeyRound size={20} aria-hidden="true" class="shrink-0 text-secondary" />
			<span>Key ending in <strong class="font-semibold tabular-nums">{entry?.last4}</strong></span>
		</p>
		<div class="flex flex-col gap-2 sm:flex-row sm:gap-4">
			{#if hasKeyTester(id)}
				<!-- aria-disabled, not disabled: a disabled button drops focus, and focus stays here. -->
				<Button variant="outline" onclick={testKey} aria-disabled={testing} class="min-w-32">
					{#if testing}
						Testing…
					{:else if isRentCast}
						Test key <CostLabel estimate="free" />
					{:else}
						Test key
					{/if}
				</Button>
			{/if}
			<Button variant="outline" onclick={replaceKey}>Replace key</Button>
			<Button variant="ghost" onclick={removeKey}>Remove key</Button>
		</div>
		{#if isRentCast && rentCastKeyTest.current}
			<RentCastKeyTestResult result={rentCastKeyTest.current} />
		{:else if testLine}
			<p class="flex items-center gap-1 text-label">
				{#if testLine.ok}
					<CircleCheck size={16} aria-hidden="true" class="shrink-0 text-secondary" />
				{:else}
					<CircleAlert size={16} aria-hidden="true" class="shrink-0 text-destructive" />
				{/if}
				{testLine.text}
			</p>
		{/if}
		{#if isRentCast}
			<p class="text-label text-muted-foreground">
				{pointerLead}<a
					href="#rentcast-usage"
					class="text-primary underline underline-offset-3 hover:text-primary-hover"
					>{POINTER_LINK}</a
				>.
			</p>
		{/if}
	{/if}
</article>
