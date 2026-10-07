<script lang="ts">
	// The "Logo" fieldset (AGT-01, UI-SPEC Profile group 3). The chosen file goes through
	// prepareLogo (content sniff, SVG rasterized to PNG, 512 KB cap) and the resulting StoredLogo is
	// handed to the form draft; nothing is stored until Save profile. The preview is an <img> on a
	// blob: URL (img-src 'self' blob:), revoked whenever the logo changes or the fieldset unmounts.
	// SVG markup is never inlined.
	import ImageUp from '@lucide/svelte/icons/image-up';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { StoredLogo } from '@tran/core/agent/types';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { prepareLogo } from './logo-pipeline';
	import { logoObjectUrl } from './logo-url';

	interface Props {
		logo: StoredLogo | null;
		/** Brokerage (preferred) or agent name for the image's alt text. */
		brokerage: string;
		name: string;
		onchange: (logo: StoredLogo | null) => void;
	}

	let { logo, brokerage, name, onchange }: Props = $props();

	const INPUT_ID = 'profile-logo-file';
	const HELP_ID = 'profile-logo-help';
	const ERROR_ID = 'profile-logo-error';

	let url = $state<string | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (!logo) {
			url = null;
			return;
		}
		const next = logoObjectUrl(logo);
		url = next;
		return () => URL.revokeObjectURL(next);
	});

	const alt = $derived(`${brokerage.trim() || name.trim() || 'Your'} logo`);

	function formatSize(bytes: number): string {
		const kb = bytes / 1024;
		if (kb < 1000)
			return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.ceil(kb))} KB`;
		return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(kb / 1024)} MB`;
	}

	async function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		// Reset so choosing the same file again (after Remove logo) fires change.
		input.value = '';
		if (!file || busy) return;
		busy = true;
		error = null;
		try {
			const result = await prepareLogo(file);
			if (result.ok) {
				onchange(result.logo);
				announce('Logo ready. Save your profile to keep it.');
			} else if (result.reason === 'too-large') {
				error = `This logo is ${formatSize(result.size)}. Choose one that's 512 KB or smaller.`;
			} else {
				error = 'Choose a PNG or SVG file.';
			}
		} finally {
			busy = false;
		}
	}

	function remove() {
		error = null;
		onchange(null);
		announce('Logo removed. Save your profile to keep this change.');
		inputEl?.focus();
	}
</script>

<fieldset class="min-w-0 rounded-lg border border-border bg-card p-6 shadow-card">
	<legend class="float-left mb-6 w-full">
		<h2 class="font-display text-heading font-semibold">Logo</h2>
	</legend>
	<div class="clear-both flex flex-wrap items-start gap-6">
		<div
			data-testid="logo-preview"
			class="flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background p-2"
		>
			{#if url}
				<img src={url} {alt} class="h-full w-full object-contain" />
			{:else}
				<span class="flex flex-col items-center gap-1 text-label text-muted-foreground">
					<ImageUp class="size-6" aria-hidden="true" />
					No logo yet
				</span>
			{/if}
		</div>
		<div class="flex min-w-0 flex-col gap-3">
			<p id={HELP_ID} class="text-label text-muted-foreground">
				PNG or SVG, up to 512 KB. A wide logo at least 600 pixels across prints best.
			</p>
			<div class="flex flex-wrap items-center gap-3">
				<label
					for={INPUT_ID}
					class="inline-flex h-12 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-6 font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring hover:bg-surface"
					aria-busy={busy ? 'true' : undefined}
				>
					{#if busy}
						<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
						Checking&hellip;
					{:else}
						Choose logo
					{/if}
					<input
						bind:this={inputEl}
						id={INPUT_ID}
						type="file"
						accept=".png,.svg,image/png,image/svg+xml"
						class="sr-only"
						disabled={busy}
						aria-describedby={error ? `${HELP_ID} ${ERROR_ID}` : HELP_ID}
						aria-invalid={error ? 'true' : undefined}
						onchange={onFileChange}
					/>
				</label>
				{#if logo}
					<Button variant="ghost" onclick={remove}>Remove logo</Button>
				{/if}
			</div>
			{#if error}
				<p id={ERROR_ID} class="flex items-center gap-1 text-label text-destructive">
					<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{error}
				</p>
			{/if}
		</div>
	</div>
</fieldset>
