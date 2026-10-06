<script lang="ts">
	// ExpenseLines (07-UI-SPEC "ExpenseLines (fieldset 5)", INV-01 "editable expense lines").
	// Renders the contents of the Operating expenses fieldset (the page owns the fieldset card and
	// its legend): the basis note, eight fixed default rows, up to 12 custom rows, Add expense line
	// (or the cap note) and the totals footer. Switching a row's unit runs core
	// convertExpenseUnit (through convertLineUnit) so the monthly dollars stay the same, and the
	// change is announced politely. Add focuses the new name input; Remove has no confirmation,
	// is announced and moves focus to the next row's name field or to Add expense line.
	import { tick } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import type { DealAnalysis } from '@tran/core/finance';
	import { usd } from '@tran/core/format';
	import { announce as defaultAnnounce } from '$lib/components/a11y/announcer.svelte';
	import {
		FIELD_ERROR_COPY,
		addCustomLine,
		canAddCustomLine,
		removeLine,
		type ExpenseLineForm,
		type FieldError,
		type FieldKey
	} from './form-model';
	import {
		UNIT_LABELS,
		computedText,
		convertLineUnit,
		lineContext,
		lineLabel
	} from './expense-lines';
	import MoneyInput from './MoneyInput.svelte';
	import PercentInput from './PercentInput.svelte';
	import UnitToggle from './UnitToggle.svelte';

	interface Props {
		/** AnalyzerForm.expenses, bound. */
		form: ExpenseLineForm[];
		analysis: DealAnalysis | null;
		/** Parsed monthly rent, or null when blank/invalid. */
		rentCents: number | null;
		errors: Partial<Record<FieldKey, FieldError>>;
		onvalidate?: (key: FieldKey) => void;
		/** Polite LiveAnnouncer callback. */
		announce?: (message: string) => void;
		idPrefix?: string;
	}

	let {
		form = $bindable(),
		analysis,
		rentCents,
		errors,
		onvalidate,
		announce = defaultAnnounce,
		idPrefix = 'expense'
	}: Props = $props();

	const UNIT_OPTIONS = [
		{ value: 'pct', label: UNIT_LABELS.pct },
		{ value: 'usd', label: UNIT_LABELS.usd }
	] as const;

	const rowId = (line: ExpenseLineForm) => `${idPrefix}-${line.id}`;
	const nameId = (line: ExpenseLineForm) => `${rowId(line)}-name`;
	const addId = $derived(`${idPrefix}-add`);
	const noteId = $derived(`${idPrefix}-note`);
	const canAdd = $derived(canAddCustomLine({ expenses: form }));

	function switchUnit(index: number, to: 'pct' | 'usd') {
		const { line, message } = convertLineUnit(form[index], to, lineContext(analysis, rentCents));
		form[index] = line;
		announce(message);
		onvalidate?.(`expense:${line.id}`);
	}

	async function addLine() {
		const next = addCustomLine({ expenses: form });
		if (next.expenses === form) return;
		form = next.expenses;
		await tick();
		const added = form[form.length - 1];
		document.getElementById(nameId(added))?.focus();
	}

	async function remove(index: number) {
		const line = form[index];
		const following = form[index + 1];
		form = removeLine({ expenses: form }, line.id).expenses;
		announce(`Removed ${line.name.trim() || 'this expense line'}.`);
		await tick();
		const target = following ? nameId(following) : addId;
		document.getElementById(target)?.focus();
	}

	const nameText = 'text-base leading-[1.6] font-semibold text-foreground';
	const textInput =
		'h-12 w-full min-w-0 rounded-md border border-input bg-card px-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
</script>

<div class="grid min-w-0 gap-4">
	<p id={noteId} class="text-label text-muted-foreground">
		Percent lines are starting assumptions. Change any of them to match the property. Tax and
		insurance stay blank until you enter them, because Tran won't guess them.
	</p>

	<div class="grid min-w-0">
		{#each form as line, i (line.id)}
			{@const key = `expense:${line.id}` as const}
			{@const error = errors[key] ? FIELD_ERROR_COPY[errors[key]] : null}
			{@const computed = computedText(line, analysis, rentCents)}
			<div
				role="group"
				aria-labelledby={nameId(line)}
				class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-b border-border py-4 sm:grid-cols-[minmax(0,1fr)_144px_auto_auto] sm:gap-4"
			>
				<div class="col-start-1 row-start-1 min-w-0 self-center">
					{#if line.kind === 'custom'}
						<label for={nameId(line)} class="text-label text-muted-foreground">Expense name</label>
						<input
							id={nameId(line)}
							type="text"
							autocomplete="off"
							maxlength="60"
							bind:value={form[i].name}
							class="{textInput} mt-1"
						/>
					{:else}
						<p id={nameId(line)} class={nameText}>{line.name}</p>
					{/if}
				</div>

				<div class="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
					{#if line.unit === 'pct'}
						<PercentInput
							id="{rowId(line)}-amount"
							label="{lineLabel(line)} amount"
							labelHidden
							bind:value={form[i].amount}
							{error}
							onvalidate={() => onvalidate?.(key)}
						/>
					{:else}
						<MoneyInput
							id="{rowId(line)}-amount"
							label="{lineLabel(line)} amount"
							labelHidden
							bind:value={form[i].amount}
							{error}
							onvalidate={() => onvalidate?.(key)}
						/>
					{/if}
				</div>

				<div class="col-span-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
					<UnitToggle
						name="{rowId(line)}-unit"
						legend="{lineLabel(line)} entered as"
						options={UNIT_OPTIONS}
						value={line.unit}
						onchange={(to) => switchUnit(i, to)}
					/>
				</div>

				{#if line.kind === 'custom'}
					<button
						type="button"
						aria-label={line.name.trim()
							? `Remove ${line.name.trim()}`
							: 'Remove this expense line'}
						onclick={() => remove(i)}
						class="col-start-2 row-start-1 inline-flex size-11 cursor-pointer items-center justify-center self-center rounded-md text-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:col-start-4"
					>
						<X class="size-5" aria-hidden="true" />
					</button>
				{/if}

				{#if computed}
					<p
						class="col-span-2 text-label text-muted-foreground tabular-nums sm:col-span-3 sm:col-start-2"
					>
						{computed}
					</p>
				{/if}
			</div>
		{/each}
	</div>

	{#if canAdd}
		<button
			id={addId}
			type="button"
			onclick={addLine}
			class="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-4 text-base leading-[1.6] font-semibold text-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			<Plus class="size-4" aria-hidden="true" />Add expense line
		</button>
	{:else}
		<p id={addId} tabindex="-1" class="text-label text-muted-foreground">
			You've added 12 custom lines, the most this form holds.
		</p>
	{/if}

	{#if analysis}
		<p class="text-base leading-[1.6] font-semibold text-foreground tabular-nums">
			Operating expenses: {usd(analysis.expensesInclVacancyMonthly)} a month · {usd(
				analysis.expensesInclVacancyMonthly * 12
			)} a year
		</p>
	{/if}
</div>
