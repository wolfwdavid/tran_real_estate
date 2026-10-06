<script lang="ts">
	// 07-UI-SPEC "WatchZipForm" (INV-05). The button shows its cost first: the CostLabel comes from
	// port.estimateCost (cache / fixtures only, never a call), read from the input handler once five
	// digits are typed, never from an effect. The one spend is the submit click, through
	// loadMarket: a cached or sample ZIP costs 0 calls, a new ZIP exactly 1. The ZIP is watched only
	// after its data loaded, so a card never appears without figures.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { validateZip } from '@tran/core/markets';
	import {
		isGatewayError,
		type CostEstimate,
		type GatewayError as GatewayErrorType
	} from '$lib/data';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import { Button, Input, Label, announce } from '$lib/features/shared/data/platform-ui';
	import { loadMarket, type LoadOutcome } from './market-load';
	import type { MarketResult, MarketsPort } from './markets-port';
	import { watchZip } from './watchedZipsRepo';

	interface Props {
		port: MarketsPort;
		/** ZIPs already watched (duplicate message before any spend). */
		watched: readonly string[];
		/** Called after the ZIP is stored; the page renders the card and focuses its heading. */
		onWatched: (zip: string, result: MarketResult) => void | Promise<void>;
		/** The ZIP input, for focus after the last card is removed. */
		input?: HTMLInputElement | null;
	}

	let { port, watched, onWatched, input = $bindable(null) }: Props = $props();

	const inputId = $props.id();
	const errorId = `${inputId}-error`;

	let value = $state('');
	let estimate = $state<CostEstimate | null>(null);
	let fieldError = $state<string | null>(null);
	let gatewayError = $state<GatewayErrorType | null>(null);
	let retryCap = $state<(() => Promise<LoadOutcome>) | null>(null);
	let adding = $state(false);

	/** Free: estimateCost reads the cache / fixtures only. Stale answers are dropped. */
	function onInput(): void {
		fieldError = null;
		const v = validateZip(value);
		if (!v.ok) {
			estimate = null;
			return;
		}
		const zip = v.zip;
		void port
			.estimateCost(zip)
			.then((e) => {
				if (validateZip(value).ok && value.trim() === zip) estimate = e;
			})
			.catch(() => {
				estimate = null;
			});
	}

	async function settle(zip: string, outcome: LoadOutcome): Promise<void> {
		if (outcome.ok) {
			const stored = await watchZip(zip);
			if (!stored.ok) {
				fieldError =
					stored.error === 'duplicate'
						? `You're already watching ${zip}.`
						: stored.error === 'limit'
							? "You're watching 5 ZIP codes, the most Tran tracks. Stop watching one to add another."
							: 'Enter a 5-digit ZIP code.';
				return;
			}
			announce(`Now watching ZIP ${zip}.`);
			value = '';
			estimate = null;
			await onWatched(zip, outcome.result);
			return;
		}
		if (outcome.kind === 'cap') {
			// "Not now" on the over-cap prompt: nothing was spent, keep the form as it is.
			if (outcome.dismissed) return;
			gatewayError = outcome.error;
			retryCap = outcome.retry;
			return;
		}
		if (!isGatewayError(outcome.error)) throw outcome.error;
		gatewayError = outcome.error;
	}

	async function run(zip: string, load: () => Promise<LoadOutcome>): Promise<void> {
		if (adding) return;
		adding = true;
		gatewayError = null;
		retryCap = null;
		try {
			await settle(zip, await load());
		} finally {
			adding = false;
		}
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const v = validateZip(value);
		if (!v.ok) {
			fieldError = 'Enter a 5-digit ZIP code.';
			input?.focus();
			return;
		}
		if (watched.includes(v.zip)) {
			fieldError = `You're already watching ${v.zip}.`;
			input?.focus();
			return;
		}
		fieldError = null;
		await run(v.zip, () => loadMarket(port, v.zip));
	}

	async function tryAgain(): Promise<void> {
		const v = validateZip(value);
		if (v.ok) await run(v.zip, () => loadMarket(port, v.zip));
	}

	function continuePastCap(): void {
		const v = validateZip(value);
		const retry = retryCap;
		if (v.ok && retry) void run(v.zip, retry);
	}
</script>

<form
	class="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6"
	novalidate
	onsubmit={submit}
>
	<div class="flex flex-col gap-2">
		<Label for={inputId} class="text-base leading-[1.6] font-semibold text-foreground"
			>ZIP code</Label
		>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
			<Input
				id={inputId}
				bind:ref={input}
				bind:value
				oninput={onInput}
				inputmode="numeric"
				maxlength={5}
				autocomplete="postal-code"
				aria-invalid={fieldError ? 'true' : undefined}
				aria-describedby={fieldError ? errorId : undefined}
				class="h-12 w-full text-base tabular-nums sm:w-36"
			/>
			<Button type="submit" class="h-12 w-full sm:w-auto" disabled={adding}>
				{#if adding}
					<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
					Adding…
				{:else}
					Watch ZIP <CostLabel {estimate} />
				{/if}
			</Button>
		</div>
		{#if fieldError}
			<p id={errorId} class="flex items-center gap-1 text-label text-destructive">
				<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{fieldError}
			</p>
		{/if}
	</div>
	{#if gatewayError}
		<GatewayError
			error={gatewayError}
			focusOnMount={true}
			onTryAgain={tryAgain}
			onContinuePastCap={continuePastCap}
		/>
	{/if}
</form>
