<script lang="ts" module>
	/** Polite announcement after a provider is chosen (05-UI-SPEC). */
	export function providerAnnouncement(providerLabel: string): string {
		return `${providerLabel} will write your drafts.`;
	}
</script>

<script lang="ts">
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import type { LiveProviderId } from '@tran/core/ai';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { aiPrefs } from '$lib/ai/prefs.svelte';
	import { PROVIDER_LABELS, PROVIDER_ORDER } from '$lib/ai/models';
	import { defaultPreferred, type AiKeyState } from '$lib/ai/setup';

	// "Draft with" (05-UI-SPEC AiProviderPicker). Four options in fixed order; each states its key
	// state and current model. Choosing applies immediately, persists in aiPrefs and is announced.
	// Keyless providers stay selectable: their drafts use sample output and the panel says why.
	// With no stored choice the first provider with a saved key is shown as checked.

	interface Props {
		keyState: (id: LiveProviderId) => AiKeyState;
		selected: LiveProviderId | null;
		onChange?: (id: LiveProviderId) => void;
	}

	let { keyState, selected = $bindable(null), onChange }: Props = $props();

	const uid = $props.id();
	const current = $derived(selected ?? defaultPreferred(keyState));
	const anyKey = $derived(PROVIDER_ORDER.some((id) => keyState(id) === 'saved'));

	const isProvider = (v: string): v is LiveProviderId =>
		(PROVIDER_ORDER as readonly string[]).includes(v);

	function choose(v: string): void {
		if (!isProvider(v) || v === current) return;
		selected = v;
		aiPrefs.provider = v;
		announce(providerAnnouncement(PROVIDER_LABELS[v]));
		onChange?.(v);
	}

	const linkClass =
		'inline-flex min-h-11 items-center text-primary underline underline-offset-3 hover:text-primary-hover';
</script>

<fieldset class="grid gap-2">
	<legend class="mb-2 text-base leading-[1.6] font-semibold text-foreground">Draft with</legend>
	<RadioGroup.Root bind:value={() => current ?? '', choose} class="grid gap-2">
		{#each PROVIDER_ORDER as id (id)}
			{@const state = keyState(id)}
			{@const label = PROVIDER_LABELS[id]}
			<label class="flex min-h-11 cursor-pointer touch-manipulation items-start gap-3 py-2">
				<RadioGroup.Item
					value={id}
					aria-labelledby="{uid}-{id}-title"
					aria-describedby="{uid}-{id}-description"
					class="mt-0.5"
				/>
				<span class="grid gap-1">
					<span id="{uid}-{id}-title" class="text-base leading-[1.6] font-semibold text-foreground"
						>{label}</span
					>
					<span
						id="{uid}-{id}-description"
						class="text-base leading-[1.6] [overflow-wrap:anywhere] text-muted-foreground"
					>
						{#if state === 'saved'}
							Key saved. Model: <code class="font-semibold">{aiPrefs.effectiveModel(id)}</code>.
						{:else if state === 'locked'}
							Key locked. Unlock it in Key security to draft with {label}.
						{:else}
							No key yet. Drafts use sample output until you add one in API keys.
						{/if}
					</span>
				</span>
			</label>
		{/each}
	</RadioGroup.Root>
</fieldset>

{#if !anyKey}
	<p class="mt-2 flex flex-wrap items-center gap-x-2 text-base leading-[1.6] text-foreground">
		<FlaskConical size={20} aria-hidden="true" class="shrink-0 text-foreground" />
		<span>
			No AI key yet, so drafts use sample output. <a href="#api-keys" class={linkClass}
				>Add an AI key</a
			> to draft with Anthropic, OpenAI, Google Gemini, or OpenRouter.
		</span>
	</p>
{/if}
