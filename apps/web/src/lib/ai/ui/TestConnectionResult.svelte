<script lang="ts" module>
	type Part = { code: boolean; value: string };

	/** Splits `line` so each occurrence of a term (model ID, host) can render inside <code>. */
	export function codeParts(line: string, terms: readonly string[]): Part[] {
		const wanted = terms.filter((t) => t.length > 0);
		const parts: Part[] = [];
		let rest = line;
		while (rest.length > 0) {
			let at = -1;
			let term = '';
			for (const t of wanted) {
				const i = rest.indexOf(t);
				if (i !== -1 && (at === -1 || i < at)) {
					at = i;
					term = t;
				}
			}
			if (at === -1) {
				parts.push({ code: false, value: rest });
				break;
			}
			if (at > 0) parts.push({ code: false, value: rest.slice(0, at) });
			parts.push({ code: true, value: term });
			rest = rest.slice(at + term.length);
		}
		return parts;
	}
</script>

<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { LiveProviderId } from '@tran/core/ai';
	import type { TestConnectionResult } from '$lib/ai/ports';
	import { PROVIDER_LABELS, hostFor } from '$lib/ai/models';
	import { testResultCopy } from './ai-copy';

	// (g) Test connection result for an AI provider key card: the five outcomes from testResultCopy
	// (accepted, CORS-blocked, rejected key, account limit, unreachable host) plus the model line.
	// Phase 3 metrics: Label 14/400 with a 16px icon. Owned by the card, so the line persists until
	// the next test or a key change. Only fixed copy, the model ID and the host are ever rendered.

	interface Props {
		provider: LiveProviderId;
		model: string;
		result: TestConnectionResult | null;
		testing: boolean;
	}

	let { provider, model, result, testing }: Props = $props();

	const host = $derived(hostFor(provider));
	const copy = $derived(
		result
			? testResultCopy(result, { provider, providerLabel: PROVIDER_LABELS[provider], model, host })
			: null
	);
	const terms = $derived([model, host]);
	const linkClass = 'text-primary underline underline-offset-3 hover:text-primary-hover';
</script>

{#snippet withCode(line: string)}
	{#each codeParts(line, terms) as part, i (i)}{#if part.code}<code
				class="font-semibold [overflow-wrap:anywhere]">{part.value}</code
			>{:else}{part.value}{/if}{/each}
{/snippet}

{#if testing}
	<p class="text-label text-muted-foreground">Testing…</p>
{:else if copy}
	<div class="grid gap-1">
		<p class="flex items-start gap-1 text-label">
			{#if copy.tone === 'ok'}
				<CircleCheck size={16} aria-hidden="true" class="mt-0.5 shrink-0 text-secondary" />
			{:else}
				<CircleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0 text-destructive" />
			{/if}
			<span>
				{@render withCode(copy.line)}
				{#if copy.action}
					<a href="#{copy.action.hash}" class={linkClass}>{copy.action.label}</a>
				{/if}
			</span>
		</p>
		{#if copy.modelLine}
			<p class="flex items-start gap-1 text-label">
				{#if copy.modelTone === 'warn'}
					<TriangleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0 text-foreground" />
				{:else}
					<CircleCheck size={16} aria-hidden="true" class="mt-0.5 shrink-0 text-secondary" />
				{/if}
				<span>{@render withCode(copy.modelLine)}</span>
			</p>
		{/if}
	</div>
{/if}
