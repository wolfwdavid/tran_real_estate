<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import MonitorDown from '@lucide/svelte/icons/monitor-down';
	import Share from '@lucide/svelte/icons/share';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { InstallOutcome, InstallState } from '$lib/pwa/install.svelte';

	// Exactly one state renders. The state object is created by InstallSection after hydration.
	let {
		install
	}: { install: { readonly state: InstallState; install(): Promise<InstallOutcome> } } = $props();

	let busy = $state(false);

	async function onInstall() {
		busy = true;
		try {
			await install.install();
		} catch {
			// A used prompt event throws InvalidStateError; the browser re-offers install on its own.
		} finally {
			busy = false;
		}
	}
</script>

<div class="mt-4 flex flex-col items-start gap-4 text-body" data-testid="install-app">
	{#if install.state === 'installable'}
		<p>
			Install Tran to open it from your home screen or desktop in its own window. It still runs
			entirely in your browser's storage on this device.
		</p>
		<Button
			onclick={onInstall}
			disabled={busy}
			aria-disabled={busy ? 'true' : undefined}
			class="gap-2"
		>
			<MonitorDown class="size-4" aria-hidden="true" />
			Install app
		</Button>
	{:else if install.state === 'ios'}
		<p>To install on iPhone or iPad:</p>
		<ol class="list-decimal pl-6">
			<li>
				Tap the Share <Share class="inline size-4 align-text-bottom" aria-hidden="true" /> button in your
				browser's toolbar or menu.
			</li>
			<li>Choose Add to Home Screen.</li>
			<li>Tap Add.</li>
		</ol>
	{:else if install.state === 'installed'}
		<p class="flex items-start gap-2">
			<CircleCheck class="mt-1 size-4 shrink-0 text-secondary" aria-hidden="true" />
			Tran is installed on this device. You're using the installed app.
		</p>
	{:else}
		<p>
			This browser doesn't offer to install Tran from this page. You can keep using it in a browser
			tab, or open it in Chrome, Edge, or Safari on iPhone to install it.
		</p>
	{/if}
</div>
