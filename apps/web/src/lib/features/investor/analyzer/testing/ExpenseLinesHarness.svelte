<script lang="ts">
	// Browser-test harness: owns the expense rows in $state and binds them the way the analyzer
	// page will, so edits, unit switches, adds and removes flow back through the binding.
	import { untrack } from 'svelte';
	import { analyze } from '@tran/core/finance';
	import ExpenseLines from '../ExpenseLines.svelte';
	import { parseForm, type AnalyzerForm, type FieldKey } from '../form-model';

	interface Props {
		initial: AnalyzerForm;
		announce: (message: string) => void;
		onvalidate: (key: FieldKey) => void;
	}

	let { initial, announce, onvalidate }: Props = $props();
	// Seeded once from the initial form; the harness owns the rows afterwards.
	let expenses = $state(untrack(() => initial.expenses.map((l) => ({ ...l }))));
	const parsed = $derived(parseForm({ ...initial, expenses }));
	const analysis = $derived(parsed.inputs ? analyze(parsed.inputs) : null);
</script>

<ExpenseLines
	bind:form={expenses}
	{analysis}
	rentCents={parsed.inputs?.rentCents ?? null}
	errors={parsed.errors}
	{announce}
	{onvalidate}
	idPrefix="x"
/>
