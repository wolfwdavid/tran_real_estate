<script lang="ts">
	// AutofillButton (07-UI-SPEC "Autofill and field provenance"): "Autofill rent estimate (1 call)"
	// / "Autofill value estimate (1 call)" with the Phase 4 CostLabel computed from the gateway
	// (estimateCost never spends). The ONLY spend is runAutofill inside the click handler (and the
	// GatewayError "Continue past cap" retry, also a click); never in $effect. The cost label is
	// refreshed on mount, after each lookup, on the form's change events and when the pointer or
	// focus reaches the button, so a restored draft or a typed address shows the right cost.
	//
	// Under the button: the GatewayError for a failed lookup (focus moves to its title) and the
	// EstimateResult reference block. The fill rule lives in autofill.ts.
	import { onMount, tick } from 'svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Wand2 from '@lucide/svelte/icons/wand-sparkles';
	import { usd } from '@tran/core/format';
	import { parseMoneyInput } from '@tran/core/finance';
	import { GatewayError as GatewayErrorValue, isGatewayError } from '@tran/core/request';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import { announce, Button } from '$lib/features/shared/data/platform-ui';
	import type { CostEstimate, Estimate, InvestorDataPort } from '../data/investor-port';
	import type { AnalyzerPageState } from './analyzer-page.svelte';
	import EstimateResult from './EstimateResult.svelte';
	import {
		applyEstimate,
		estimateQueryFromForm,
		runAutofill,
		TARGET_FIELD,
		useEstimate,
		type AutofillOutcome,
		type AutofillTarget
	} from './autofill';

	interface Props {
		port: InvestorDataPort;
		s: AnalyzerPageState;
		target: AutofillTarget;
		/** Shows the Address error and focuses Address (no request is made). */
		onaddressmissing: () => void;
	}

	let { port, s, target, onaddressmissing }: Props = $props();

	const LABEL = { rent: 'Autofill rent estimate', value: 'Autofill value estimate' } as const;
	const FIELD_ID = { rent: 'rent', value: 'price' } as const;

	let root = $state<HTMLDivElement | null>(null);
	let cost = $state<CostEstimate | null>(null);
	let running = $state(false);
	let estimate = $state<Estimate | null>(null);
	let failure = $state<{ error: GatewayErrorValue; retry?: () => Promise<AutofillOutcome> } | null>(
		null
	);

	/** Free: cache / sample lookups only. */
	async function refreshCost(): Promise<void> {
		const q = estimateQueryFromForm(s.form) ?? { address: '' };
		try {
			cost = await port.estimateCost({ kind: target, q });
		} catch {
			cost = null;
		}
	}

	onMount(() => {
		void refreshCost();
		const form = root?.closest('form');
		const onChange = () => void refreshCost();
		form?.addEventListener('change', onChange);
		return () => form?.removeEventListener('change', onChange);
	});

	function setBusy(busy: boolean) {
		const fs = root?.closest('fieldset');
		if (!fs) return;
		if (busy) fs.setAttribute('aria-busy', 'true');
		else fs.removeAttribute('aria-busy');
	}

	const sourceWord = (e: Estimate) =>
		e.provenance.source === 'sample' ? 'from sample data' : 'from RentCast';

	async function handle(outcome: AutofillOutcome): Promise<void> {
		switch (outcome.kind) {
			case 'no-address':
				onaddressmissing();
				return;
			case 'cap':
				// "Not now" on the over-cap prompt: nothing was spent, keep what is on screen.
				if (!outcome.dismissed) failure = { error: outcome.error, retry: outcome.retry };
				return;
			case 'error':
				// A non-gateway failure (e.g. storage unavailable) reads as a network problem.
				failure = {
					error: isGatewayError(outcome.error)
						? outcome.error
						: new GatewayErrorValue({ kind: 'NetworkError' })
				};
				return;
			case 'ok': {
				const e = outcome.estimate;
				estimate = e;
				const out = applyEstimate(s.form, s.sources, target, e);
				const x = usd(Math.round(e.amountCents / 100) * 100);
				if (out.kind === 'filled') {
					s.form = out.form;
					s.sources = out.sources;
					announce(
						target === 'rent'
							? `Rent estimate filled: ${x} a month ${sourceWord(e)}.`
							: `Value estimate filled: ${x} ${sourceWord(e)}.`
					);
				} else {
					announce(
						`RentCast estimate: ${x}. Your number was kept. Use the estimate button to replace it.`
					);
				}
			}
		}
	}

	async function run(step: () => Promise<AutofillOutcome>): Promise<void> {
		if (running) return;
		running = true;
		failure = null;
		setBusy(true);
		try {
			await handle(await step());
		} finally {
			running = false;
			setBusy(false);
			void refreshCost();
		}
	}

	/** Click handler: the autofill spend path. */
	function onclick() {
		void run(() => runAutofill(port, target, $state.snapshot(s.form) as typeof s.form));
	}

	/** GatewayError "Continue past cap" (a click): asks again through the runtime's prompt. */
	function continuePastCap() {
		const retry = failure?.retry;
		if (retry) void run(retry);
	}

	/** GatewayError "Try again" (a click). */
	async function tryAgain(): Promise<void> {
		await run(() => runAutofill(port, target, $state.snapshot(s.form) as typeof s.form));
	}

	async function useIt() {
		if (!estimate) return;
		const out = useEstimate(s.form, s.sources, target, estimate);
		s.form = out.form;
		s.sources = out.sources;
		await tick();
		document.getElementById(FIELD_ID[target])?.focus();
	}

	const priceCents = $derived.by(() => {
		const r = parseMoneyInput(s.form.price);
		return r.ok ? r.value : null;
	});
</script>

<div bind:this={root} class="grid min-w-0 gap-4" data-autofill={target}>
	<div>
		<Button
			variant="outline"
			disabled={running}
			{onclick}
			onpointerenter={() => void refreshCost()}
			onfocus={() => void refreshCost()}
		>
			{#if running}
				<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
				Looking up…
			{:else}
				<Wand2 class="size-4" aria-hidden="true" />
				{LABEL[target]}
				<CostLabel estimate={cost} />
			{/if}
		</Button>
	</div>
	{#if failure}
		<GatewayError
			error={failure.error}
			focusOnMount
			onTryAgain={tryAgain}
			onContinuePastCap={failure.retry ? continuePastCap : undefined}
		/>
	{/if}
	{#if estimate}
		<EstimateResult
			{target}
			{estimate}
			fieldValue={s.form[TARGET_FIELD[target]]}
			priceCents={target === 'value' ? priceCents : null}
			onuse={() => void useIt()}
		/>
	{/if}
</div>
