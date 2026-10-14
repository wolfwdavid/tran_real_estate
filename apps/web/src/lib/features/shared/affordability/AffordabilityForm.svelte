<script lang="ts">
	// 06-UI-SPEC "AffordabilityForm" (RENT-08). Three money fields with the Phase 3 field anatomy and
	// the income period chips. Props and local state only: no storage, no data layer, no network.
	// Values are bound to the parent calculator, which owns all state in $state and saves nothing.
	import ToolIcon from '$lib/components/tools/ToolIcon.svelte';
	import { parseMoneyInput, type IncomePeriod } from '@tran/core/renter/affordability';

	interface Props {
		income?: string;
		period?: IncomePeriod;
		debts?: string;
		savings?: string;
		idPrefix?: string;
	}

	let {
		income = $bindable(''),
		period = $bindable<IncomePeriod>('year'),
		debts = $bindable(''),
		savings = $bindable(''),
		idPrefix = 'afford'
	}: Props = $props();

	const INCOME_ERROR = 'Enter your income before taxes, like 60,000.';
	const NUMBER_ERROR = 'Use a number of 0 or more.';
	const DEBTS_HELP = 'Car, student loan, and credit card minimums. Leave 0 if none.';
	const SAVINGS_HELP = "Cash you could put toward a deposit and first month's rent.";

	let incomeTouched = $state(false);

	const incomeError = $derived.by(() => {
		const parsed = parseMoneyInput(income);
		if (typeof parsed === 'object' && parsed !== null) {
			return parsed.error === 'negative' ? NUMBER_ERROR : INCOME_ERROR;
		}
		if (incomeTouched && (parsed === null || parsed === 0)) return INCOME_ERROR;
		return null;
	});

	function numberError(value: string): string | null {
		const parsed = parseMoneyInput(value);
		return typeof parsed === 'object' && parsed !== null ? NUMBER_ERROR : null;
	}

	const debtsError = $derived(numberError(debts));
	const savingsError = $derived(numberError(savings));

	const ids = $derived({
		income: `${idPrefix}-income`,
		incomeLabel: `${idPrefix}-income-label`,
		incomeError: `${idPrefix}-income-error`,
		debts: `${idPrefix}-debts`,
		debtsHelp: `${idPrefix}-debts-help`,
		debtsError: `${idPrefix}-debts-error`,
		savings: `${idPrefix}-savings`,
		savingsHelp: `${idPrefix}-savings-help`,
		savingsError: `${idPrefix}-savings-error`
	});

	const PERIODS: ReadonlyArray<{ value: IncomePeriod; label: string }> = [
		{ value: 'year', label: 'a year' },
		{ value: 'month', label: 'a month' }
	];

	const inputClass = (error: string | null) =>
		`h-12 w-full min-w-0 rounded-md border bg-card pr-4 pl-8 text-base leading-[1.6] text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
			error ? 'border-destructive' : 'border-input'
		}`;

	const describedBy = (...ids: Array<string | null | false>) =>
		ids.filter(Boolean).join(' ') || undefined;
</script>

{#snippet dollar()}
	<span
		aria-hidden="true"
		class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base leading-[1.6] text-muted-foreground"
		>$</span
	>
{/snippet}

{#snippet fieldError(id: string, message: string)}
	<p {id} class="flex items-center gap-1 text-label text-destructive">
		<ToolIcon name="circle-alert" class="size-4 shrink-0" />
		{message}
	</p>
{/snippet}

<div class="grid gap-6 rounded-lg border border-border bg-card p-6">
	<div class="grid gap-2">
		<label
			id={ids.incomeLabel}
			for={ids.income}
			class="text-base leading-[1.6] font-semibold text-foreground">Income before taxes</label
		>
		<div class="flex flex-wrap items-center gap-3">
			<div class="relative min-w-0 flex-1 basis-40">
				{@render dollar()}
				<input
					id={ids.income}
					bind:value={income}
					name="income"
					type="text"
					inputmode="decimal"
					autocomplete="off"
					aria-invalid={incomeError ? 'true' : undefined}
					aria-describedby={describedBy(incomeError && ids.incomeError)}
					onblur={() => (incomeTouched = true)}
					class={inputClass(incomeError)}
				/>
			</div>
			<div role="radiogroup" aria-labelledby={ids.incomeLabel} class="flex gap-2">
				{#each PERIODS as option (option.value)}
					<label
						class="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border border-input bg-card px-4 text-base leading-[1.6] text-foreground has-checked:border-2 has-checked:border-primary has-checked:font-semibold"
					>
						<input
							type="radio"
							name="{idPrefix}-period"
							value={option.value}
							bind:group={period}
							class="size-5 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						/>
						{option.label}
					</label>
				{/each}
			</div>
		</div>
		{#if incomeError}{@render fieldError(ids.incomeError, incomeError)}{/if}
	</div>

	<div class="grid gap-2">
		<label for={ids.debts} class="text-base leading-[1.6] font-semibold text-foreground"
			>Monthly debt payments</label
		>
		<div class="relative">
			{@render dollar()}
			<input
				id={ids.debts}
				bind:value={debts}
				name="debts"
				type="text"
				inputmode="decimal"
				autocomplete="off"
				placeholder="0"
				aria-invalid={debtsError ? 'true' : undefined}
				aria-describedby={describedBy(ids.debtsHelp, debtsError && ids.debtsError)}
				class={inputClass(debtsError)}
			/>
		</div>
		<p id={ids.debtsHelp} class="text-label text-muted-foreground">{DEBTS_HELP}</p>
		{#if debtsError}{@render fieldError(ids.debtsError, debtsError)}{/if}
	</div>

	<div class="grid gap-2">
		<label for={ids.savings} class="text-base leading-[1.6] font-semibold text-foreground"
			>Savings for moving</label
		>
		<div class="relative">
			{@render dollar()}
			<input
				id={ids.savings}
				bind:value={savings}
				name="savings"
				type="text"
				inputmode="decimal"
				autocomplete="off"
				aria-invalid={savingsError ? 'true' : undefined}
				aria-describedby={describedBy(ids.savingsHelp, savingsError && ids.savingsError)}
				class={inputClass(savingsError)}
			/>
		</div>
		<p id={ids.savingsHelp} class="text-label text-muted-foreground">{SAVINGS_HELP}</p>
		{#if savingsError}{@render fieldError(ids.savingsError, savingsError)}{/if}
	</div>
</div>
