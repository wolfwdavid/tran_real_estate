<script lang="ts">
	// 07-UI-SPEC "DealCard" (INV-03): one saved deal with its four headline figures (recomputed from
	// the stored inputs, never stored), a Compare checkbox and Open / Memo / Delete. Delete asks
	// first; focus after a removal is owned by DealsList (the card unmounts only after the liveQuery
	// emits), so this card reports the intent before it writes (06-15 board pattern).
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { NOT_AVAILABLE, pct, ratio, usd } from '@tran/core/format';
	import {
		announce,
		Button,
		buttonVariants,
		ConfirmDialog
	} from '$lib/features/shared/data/platform-ui';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import { formatRelative } from '$lib/features/shared/data/relative-time';
	import { deleteDeal } from './dealsRepo';
	import type { DealRow } from './deals-view';

	interface Props {
		row: DealRow;
		now: number;
		selected: boolean;
		/** Three other deals are already selected: the box stays focusable but refuses to check. */
		atCap: boolean;
		ontoggle: (id: string) => void;
		onDeleting?: (id: string) => void;
		onDeleteFailed?: () => void;
	}

	let { row, now, selected, atCap, ontoggle, onDeleting, onDeleteFailed }: Props = $props();

	const record = $derived(row.record);
	const a = $derived(row.analysis);
	const headingId = $derived(`deal-${record.id}-name`);
	const sample = $derived(Object.values(record.sources ?? {}).some((s) => s?.source === 'sample'));
	const disabled = $derived(atCap && !selected);
	const savedRelative = $derived(formatRelative(Date.parse(record.updatedAt), now));
	const idQuery = $derived(`?id=${encodeURIComponent(record.id)}`);

	const fmt = (v: number | null, f: (n: number) => string) =>
		v === null || !Number.isFinite(v) ? NOT_AVAILABLE : f(v);
	const metrics = $derived([
		{ key: 'cashFlow', label: 'Monthly cash flow', value: fmt(a.cashFlowMonthly, usd) },
		{ key: 'capRate', label: 'Cap rate', value: fmt(a.capRatePct, (v) => pct(v, 1)) },
		{ key: 'coc', label: 'Cash-on-cash', value: fmt(a.cocPct, (v) => pct(v, 1)) },
		{ key: 'dscr', label: 'DSCR', value: fmt(a.dscr, (v) => ratio(v, 2)) }
	]);

	const SAMPLE = { source: 'sample', fetchedAt: 0, stale: false } as const;
	const deleteBody = [
		"This removes the deal and its memo drafts from this browser. It can't be undone. Download a backup first if you might want it later."
	];

	let confirmOpen = $state(false);
	let deleteEl = $state<HTMLElement | null>(null);
	let deleted = false;

	async function remove(): Promise<void> {
		const name = record.name;
		onDeleting?.(record.id);
		try {
			await deleteDeal(record.id);
		} catch (error) {
			onDeleteFailed?.();
			throw error;
		}
		deleted = true;
		announce(`Deleted ${name}.`);
	}

	/** bits-ui refocuses the trigger; after a delete DealsList focuses the next card instead. */
	function restoreFocus(e: Event): void {
		e.preventDefault();
		if (!deleted) void tick().then(() => deleteEl?.focus());
	}

	function onCompareClick(e: MouseEvent): void {
		if (disabled) {
			e.preventDefault();
			ontoggle(record.id);
		}
	}

	const termCls = 'text-label text-muted-foreground';
</script>

<article
	aria-labelledby={headingId}
	data-deal-card={record.id}
	data-provenance={sample ? 'sample' : undefined}
	class="flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6"
>
	<header class="flex flex-col gap-1">
		<h2
			id={headingId}
			tabindex="-1"
			class="text-base leading-[1.6] font-semibold [overflow-wrap:anywhere] text-foreground focus:outline-none"
		>
			{record.name}
		</h2>
		{#if record.address}
			<p class="text-base leading-[1.6] [overflow-wrap:anywhere] text-muted-foreground">
				{record.address}
			</p>
		{/if}
		{#if sample}<span><ProvenanceChip provenance={SAMPLE} now={0} /></span>{/if}
	</header>

	<dl class="grid grid-cols-2 gap-4">
		{#each metrics as m (m.key)}
			<div class="min-w-0" data-metric={m.key}>
				<dt class={termCls}>{m.label}</dt>
				<dd class="font-display text-heading font-semibold text-foreground tabular-nums">
					{m.value}
				</dd>
			</div>
		{/each}
	</dl>

	<p class={termCls}>Saved {savedRelative}</p>

	<label
		class="inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 self-start text-base leading-[1.6] text-foreground has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring {disabled
			? 'cursor-not-allowed text-muted-foreground'
			: ''}"
	>
		<input
			type="checkbox"
			class="size-5 accent-primary"
			checked={selected}
			aria-disabled={disabled ? 'true' : undefined}
			data-compare-checkbox={record.id}
			onclick={onCompareClick}
			onchange={() => ontoggle(record.id)}
		/>
		<span>Compare<span class="sr-only"> {record.name}</span></span>
	</label>

	<div class="mt-auto flex flex-wrap gap-2">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus the deal's ?id= -->
		<a
			href={`${resolve('/investor/analyze/')}${idQuery}`}
			class={buttonVariants({ variant: 'outline' })}
			>Open<span class="sr-only"> {record.name}</span></a
		>
		<a href={`${resolve('/investor/memo/')}${idQuery}`} class={buttonVariants({ variant: 'ghost' })}
			>Memo<span class="sr-only"> for {record.name}</span></a
		>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<ConfirmDialog
			bind:open={confirmOpen}
			title={`Delete ${record.name}?`}
			body={deleteBody}
			confirmLabel="Delete deal"
			confirmBusyLabel="Deleting…"
			cancelLabel="Keep deal"
			onConfirm={remove}
			onCloseAutoFocus={restoreFocus}
		>
			{#snippet trigger({ props })}
				<Button {...props} bind:ref={deleteEl} variant="destructive-outline">
					<Trash2 size={16} aria-hidden="true" />
					Delete<span class="sr-only"> {record.name}</span>
				</Button>
			{/snippet}
		</ConfirmDialog>
	</div>
</article>
