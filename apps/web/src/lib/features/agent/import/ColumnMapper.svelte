<script lang="ts">
	// UI-SPEC "CsvImport" step 2 (AGT-07): one stacked row per CSV header with the header name, an
	// example value from the file and a native select over the Tran fields. The parent owns the
	// mapping (seeded by autoMap) and the validation result; this component only renders and
	// reports changes.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import {
		MAPPING_LABELS,
		MAPPING_TARGETS,
		type MappingError,
		type MappingTarget
	} from '@tran/core/csv';
	import { Button } from '$lib/features/shared/data/platform-ui';
	import NativeSelect from '../ui/NativeSelect.svelte';

	let {
		headers,
		samples,
		mapping,
		errors,
		checking = false,
		onmap,
		oncheck,
		onreset
	}: {
		headers: readonly string[];
		/** First non-empty value per column, already truncated for display ('' when none). */
		samples: readonly string[];
		mapping: readonly MappingTarget[];
		errors: readonly MappingError[];
		checking?: boolean;
		onmap: (column: number, target: MappingTarget) => void;
		oncheck: () => void;
		onreset: () => void;
	} = $props();

	const uid = $props.id();
	const OPTIONS = MAPPING_TARGETS.map((t) => ({ value: t, label: MAPPING_LABELS[t] }));

	let errorsEl = $state<HTMLElement | null>(null);

	const columnName = (h: string, i: number) => (h.trim() === '' ? `Column ${i + 1}` : h);

	function errorText(e: MappingError): string {
		if (e === 'need-name') return 'Match a column to Name, or to First name and Last name.';
		if (e === 'need-contact') return 'Match a column to Email or Phone.';
		return `Two columns are matched to ${MAPPING_LABELS[e.field]}. Choose one.`;
	}

	$effect(() => {
		if (errors.length > 0) errorsEl?.focus();
	});
</script>

<div class="grid max-w-[640px] gap-6" data-testid="column-mapper">
	<h3 class="text-base leading-[1.6] font-semibold">Match your columns</h3>
	<ol class="grid gap-4">
		{#each headers as header, i (i)}
			<li class="grid gap-2 rounded-lg border border-border bg-card p-4">
				<p class="text-base leading-[1.6] font-semibold break-words">{columnName(header, i)}</p>
				{#if samples[i]}
					<p class="text-label break-words text-muted-foreground">e.g. {samples[i]}</p>
				{/if}
				<NativeSelect
					id={`${uid}-col-${i}`}
					label={`Import "${columnName(header, i)}" as`}
					value={mapping[i] ?? 'skip'}
					options={OPTIONS}
					disabled={checking}
					onchange={(v) => onmap(i, v as MappingTarget)}
				/>
			</li>
		{/each}
	</ol>

	{#if errors.length > 0}
		<div
			bind:this={errorsEl}
			tabindex="-1"
			class="grid gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			data-testid="mapping-errors"
		>
			{#each errors as e, i (i)}
				<p class="flex items-center gap-1 text-label text-destructive">
					<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
					{errorText(e)}
				</p>
			{/each}
		</div>
	{/if}

	<div class="flex flex-wrap gap-3">
		<Button class="min-h-11" disabled={checking} onclick={oncheck}>
			{checking ? 'Checking…' : 'Check file'}
		</Button>
		<Button variant="ghost" class="min-h-11" disabled={checking} onclick={onreset}>
			Choose a different file
		</Button>
	</div>
</div>
