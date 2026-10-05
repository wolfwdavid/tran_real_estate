<script lang="ts" module>
	import { validateModelId } from '$lib/ai/models';

	/** Inline validation copy (05-UI-SPEC), or null when the model ID is acceptable. */
	export function modelFieldError(value: string, providerLabel: string): string | null {
		switch (validateModelId(value)) {
			case 'empty':
				return 'Enter a model name, or choose Use default.';
			case 'spaces':
				return `Model names don't contain spaces. Copy the exact name from ${providerLabel}.`;
			default:
				return null;
		}
	}

	/** Polite announcement after a save (`model`) or a reset (`null`). */
	export function modelSavedAnnouncement(providerLabel: string, model: string | null): string {
		return model === null
			? `${providerLabel} model reset to the default.`
			: `${providerLabel} model set to ${model}.`;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { LiveProviderId } from '@tran/core/ai';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { PROVIDER_LABELS, defaultModel } from '$lib/ai/models';

	// (f) Model override inside an AI provider key card (05-UI-SPEC ProviderKeyCard additions).
	// Free text because model lists change. Saves on blur or Enter when valid and changed; Use
	// default (shown only off the default) resets. `onSave(null)` means "use the default".

	interface Props {
		provider: LiveProviderId;
		value: string;
		onSave: (model: string | null) => void;
	}

	let { provider, value, onSave }: Props = $props();

	const uid = $props.id();
	const inputId = `${uid}-model`;
	const helperId = `${uid}-model-helper`;
	const errorId = `${uid}-model-error`;

	const label = $derived(PROVIDER_LABELS[provider]);
	const fallback = $derived(defaultModel(provider));

	// Follows the saved value (a reset, another tab); typing overrides it until the next change.
	let draft = $derived(value);
	let error = $state<string | null>(null);
	let inputRef = $state<HTMLInputElement | null>(null);

	function save(model: string | null): boolean {
		try {
			onSave(model);
			return true;
		} catch {
			error = modelFieldError(draft, label) ?? 'Enter a model name, or choose Use default.';
			return false;
		}
	}

	function commit(): void {
		const problem = modelFieldError(draft, label);
		if (problem) {
			error = problem;
			return;
		}
		error = null;
		const trimmed = draft.trim();
		draft = trimmed;
		if (trimmed === value) return;
		// Typing the default back in is the same as Use default.
		const next = trimmed === fallback ? null : trimmed;
		if (save(next)) announce(modelSavedAnnouncement(label, next));
	}

	function onkeydown(e: KeyboardEvent): void {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		commit();
	}

	async function useDefault(): Promise<void> {
		error = null;
		draft = fallback;
		if (!save(null)) return;
		announce(modelSavedAnnouncement(label, null));
		// The button disappears once the value is the default; keep focus on the field.
		await tick();
		inputRef?.focus();
	}
</script>

<div class="grid gap-2">
	<Label for={inputId}>Model</Label>
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
		<Input
			id={inputId}
			bind:ref={inputRef}
			bind:value={draft}
			autocomplete="off"
			spellcheck="false"
			autocapitalize="off"
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${helperId} ${errorId}` : helperId}
			class="text-base leading-[1.6] tabular-nums"
			onblur={commit}
			{onkeydown}
		/>
		{#if value !== fallback}
			<Button variant="ghost" onclick={() => void useDefault()}>Use default</Button>
		{/if}
	</div>
	<p id={helperId} class="text-label [overflow-wrap:anywhere] text-muted-foreground">
		Default: <code class="font-semibold">{fallback}</code>. Change this only if you want a different
		model from {label}.
	</p>
	{#if error}
		<p id={errorId} class="flex items-center gap-1 text-label text-destructive">
			<CircleAlert size={16} aria-hidden="true" class="shrink-0" />
			{error}
		</p>
	{/if}
</div>
