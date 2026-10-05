<script lang="ts">
	// 06-UI-SPEC "AffordabilityCalculator" (RENT-08). Zero API calls and no persistence: every input
	// lives in this component's $state only. Nothing is written to IndexedDB, prefs, the URL or
	// backups, so a reload starts empty. Reused on a marketing page in Phase 10, so it imports only
	// core math, UI primitives and icons (lint-enforced by the shared/affordability boundary).
	import { announce } from '$lib/components/a11y/announcer.svelte.js';
	import {
		affordability,
		parseMoneyInput,
		type IncomePeriod
	} from '@tran/core/renter/affordability';
	import { formatRent } from '@tran/core/renter/format';
	import AffordabilityForm from './AffordabilityForm.svelte';
	import AffordabilityResult from './AffordabilityResult.svelte';
	import GoodToKnow from './GoodToKnow.svelte';

	/** Results update this long after typing stops (UI-SPEC). */
	const SETTLE_MS = 300;
	/** The result is announced this long after typing stops (UI-SPEC live-region table). */
	const ANNOUNCE_MS = 1000;

	let income = $state('');
	let period = $state<IncomePeriod>('year');
	let debts = $state('');
	let savings = $state('');
	let tried = $state<number | null>(null);

	// The inputs the result is computed from; they follow the typed values once typing settles.
	let settled = $state({ income: '', period: 'year' as IncomePeriod, debts: '', savings: '' });

	$effect(() => {
		const next = { income, period, debts, savings };
		const timer = setTimeout(() => (settled = next), SETTLE_MS);
		return () => clearTimeout(timer);
	});

	const amount = (s: string): number => {
		const v = parseMoneyInput(s);
		return typeof v === 'number' ? v : 0;
	};

	const debtsValue = $derived(amount(settled.debts));
	const savingsValue = $derived(amount(settled.savings));
	const result = $derived.by(() => {
		const v = parseMoneyInput(settled.income);
		return affordability({
			income: typeof v === 'number' ? v : null,
			period: settled.period,
			debts: debtsValue,
			savings: savingsValue
		});
	});

	const money = (n: number): string => formatRent(n) ?? '$0';
	const announcement = $derived(
		result === null
			? null
			: result.onlyTop
				? `Rent that fits: up to ${money(result.high)} a month.`
				: `Rent that fits: ${money(result.low)} to ${money(result.high)} a month.`
	);

	// A new top of the range resets the tried rent to it. A primitive $derived only notifies when
	// the value changes, so typing savings or debts that keep the same top leaves the slider alone.
	const high = $derived(result?.high ?? null);
	$effect(() => {
		void high;
		tried = null;
	});

	$effect(() => {
		const message = announcement;
		if (message === null) return;
		const timer = setTimeout(() => announce(message), ANNOUNCE_MS - SETTLE_MS);
		return () => clearTimeout(timer);
	});
</script>

<div class="grid gap-8 lg:grid-cols-2 lg:items-start">
	<AffordabilityForm bind:income bind:period bind:debts bind:savings />
	<div class="grid gap-8 lg:sticky lg:top-4">
		<AffordabilityResult {result} debts={debtsValue} savings={savingsValue} bind:tried />
		<GoodToKnow />
	</div>
</div>
