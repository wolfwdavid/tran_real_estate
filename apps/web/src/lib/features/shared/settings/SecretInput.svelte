<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	// Masked secret entry (API keys, passphrases). Visible label, show/hide toggle, helper and error.
	// No placeholder: the label and helper carry all the guidance. Password managers are told to
	// keep out of API key fields (data-1p-ignore / data-lpignore) unless `autocomplete` asks in.

	interface Props {
		id: string;
		label: string;
		value?: string;
		helper?: string;
		error?: string;
		autocomplete: 'off' | 'current-password' | 'new-password';
		showLabel?: string;
		/** Tabular digits for short numeric-looking secrets. */
		digits?: boolean;
		disabled?: boolean;
		inputRef?: HTMLInputElement | null;
	}

	let {
		id,
		label,
		value = $bindable(''),
		helper,
		error,
		autocomplete,
		showLabel = 'Show key',
		digits = false,
		disabled = false,
		inputRef = $bindable(null)
	}: Props = $props();

	let shown = $state(false);
	// Reference only the helper/error nodes that exist.
	const describedBy = $derived(
		[helper && `${id}-helper`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
	);

	/** Masks the value again (call after saving or when the form closes). */
	export function hide(): void {
		shown = false;
	}
</script>

<div class="grid gap-2">
	<Label for={id}>{label}</Label>
	<div class="flex gap-2">
		<Input
			{id}
			bind:ref={inputRef}
			bind:value
			type={shown ? 'text' : 'password'}
			{autocomplete}
			autocapitalize="off"
			autocorrect="off"
			spellcheck="false"
			inputmode="text"
			data-1p-ignore
			data-lpignore="true"
			aria-describedby={describedBy}
			aria-invalid={error ? 'true' : undefined}
			class={digits ? 'key-digits' : undefined}
			{disabled}
		/>
		<Button
			variant="outline"
			size="icon"
			aria-label={showLabel}
			aria-pressed={shown}
			aria-controls={id}
			{disabled}
			onclick={() => (shown = !shown)}
		>
			{#if shown}
				<EyeOff class="size-5" aria-hidden="true" />
			{:else}
				<Eye class="size-5" aria-hidden="true" />
			{/if}
		</Button>
	</div>
	{#if helper}
		<p id="{id}-helper" class="text-label text-muted-foreground">{helper}</p>
	{/if}
	{#if error}
		<p id="{id}-error" class="flex items-center gap-1 text-label text-destructive">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
			{error}
		</p>
	{/if}
</div>
