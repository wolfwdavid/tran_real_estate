<script lang="ts">
	// BuyBoxForm (07-UI-SPEC "Buy boxes"): in flow, never a dialog. New buy box / Edit {name}.
	// "Save and check now ({cost})" shows its cost first: the CostLabel comes from the investor
	// port's estimateCost for the location (free: cache / fixtures only), read from the Location
	// input's input/change handlers and on mount, never from an effect. Saving writes storage only;
	// the check (the one spend) is the page's onSaved(…, true) continuation of this click.
	// Validation runs on blur and on save, never on each keystroke.
	import { onMount, tick, untrack } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import CostLabel from '$lib/features/shared/data/CostLabel.svelte';
	import SectionError from '$lib/features/shared/settings/SectionError.svelte';
	import { Button } from '$lib/features/shared/data/platform-ui';
	import type { CostEstimate, InvestorDataPort } from '../data/investor-port';
	import { BUY_BOX_PROPERTY_TYPES, type BuyBoxRepo, type BuyBoxView } from './buyBoxRepo';
	import {
		buyBoxToForm,
		emptyBuyBoxForm,
		PROPERTY_TYPE_LABELS,
		toBuyBoxInput,
		type BuyBoxFormErrors,
		type BuyBoxFormState
	} from './buybox-form';

	interface Props {
		repo: BuyBoxRepo;
		investor: InvestorDataPort;
		/** The box being edited, or null for a new one. */
		editing: BuyBoxView | null;
		/** After the save: `check` is true for "Save and check now" (the page runs the check). */
		onSaved: (box: BuyBoxView, check: boolean) => Promise<void>;
		onCancel: () => void;
	}

	let { repo, investor, editing, onSaved, onCancel }: Props = $props();

	const uid = $props.id();
	const id = (name: string) => `${uid}-${name}`;

	// The form copies the edited box once; later prop changes do not reset typing.
	const start = untrack(() => editing);
	let f = $state<BuyBoxFormState>(start ? buyBoxToForm(start) : emptyBuyBoxForm());
	let errors = $state<BuyBoxFormErrors>({});
	let cost = $state<CostEstimate | null>(null);
	let saving = $state<false | 'check' | 'only'>(false);
	let saveFailed = $state(false);
	let nameEl = $state<HTMLInputElement | null>(null);
	let formEl = $state<HTMLFormElement | null>(null);
	const title = start ? `Edit ${start.name}` : 'New buy box';

	/** Free: cache / fixtures only. An unrecognized location shows no cost. */
	async function refreshCost(): Promise<void> {
		const location = f.location.trim();
		if (location === '') {
			cost = null;
			return;
		}
		try {
			const c = await investor.estimateCost({ kind: 'sale', location });
			if (f.location.trim() === location) cost = c;
		} catch {
			if (f.location.trim() === location) cost = null;
		}
	}

	onMount(() => {
		void refreshCost();
		nameEl?.focus();
	});

	/** On blur: show or clear this field's error only. */
	function validate(key: keyof BuyBoxFormState): void {
		const next = { ...errors };
		const e = toBuyBoxInput(f).errors[key];
		if (e) next[key] = e;
		else delete next[key];
		// A price edit can fix or cause the min > max error on the other bound.
		if (key === 'maxPrice') {
			const m = toBuyBoxInput(f).errors.minPrice;
			if (m) next.minPrice = m;
			else delete next.minPrice;
		}
		errors = next;
	}

	async function save(check: boolean): Promise<void> {
		if (saving) return;
		saveFailed = false;
		const { input, errors: all } = toBuyBoxInput($state.snapshot(f) as BuyBoxFormState);
		errors = all;
		if (!input) {
			await tick();
			formEl?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
			return;
		}
		saving = check ? 'check' : 'only';
		let box: BuyBoxView;
		try {
			box = editing ? await repo.updateBuyBox(editing.id, input) : await repo.createBuyBox(input);
		} catch {
			saving = false;
			saveFailed = true;
			return;
		}
		try {
			await onSaved(box, check);
		} finally {
			saving = false;
		}
	}

	const errId = (key: keyof BuyBoxFormState) => id(`${key}-error`);
	const described = (key: keyof BuyBoxFormState, helper?: string) =>
		[helper, errors[key] ? errId(key) : undefined].filter(Boolean).join(' ') || undefined;

	const BEDS = [
		{ value: '0', label: 'Any' },
		{ value: '1', label: '1+' },
		{ value: '2', label: '2+' },
		{ value: '3', label: '3+' },
		{ value: '4', label: '4+' }
	] as const;

	const fieldset = 'm-0 min-w-0 border-0 p-0';
	const labelCls = 'text-base leading-[1.6] font-semibold text-foreground';
	const legendCls = 'mb-2 text-base leading-[1.6] font-semibold text-foreground';
	const helperCls = 'text-label text-muted-foreground';
	const inputCls =
		'h-12 w-full min-w-0 rounded-md border border-input bg-card px-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[invalid=true]:border-destructive';
	const choice =
		'inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 rounded-md border border-input px-4 text-base leading-[1.6] text-foreground has-[input:checked]:font-semibold has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring';
</script>

{#snippet fieldError(key: keyof BuyBoxFormState)}
	{#if errors[key]}
		<p id={errId(key)} class="flex items-center gap-1 text-label text-destructive">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{errors[key]}
		</p>
	{/if}
{/snippet}

{#snippet textField(
	key:
		'name' | 'location' | 'minPrice' | 'maxPrice' | 'minCapRate' | 'minRentToPrice' | 'expensePct',
	label: string,
	opts: { helper?: string; inputmode?: 'decimal' | 'text'; prefix?: string; suffix?: string }
)}
	<div class="grid min-w-0 content-start gap-2">
		<label for={id(key)} class={labelCls}>{label}</label>
		<div class="relative">
			{#if opts.prefix}
				<span
					class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base text-muted-foreground"
					aria-hidden="true">{opts.prefix}</span
				>
			{/if}
			<input
				id={id(key)}
				bind:value={f[key]}
				type="text"
				autocomplete="off"
				inputmode={opts.inputmode ?? 'text'}
				aria-invalid={errors[key] ? 'true' : undefined}
				aria-describedby={described(key, opts.helper ? id(`${key}-help`) : undefined)}
				class="{inputCls} {opts.prefix ? 'pl-8' : ''} {opts.suffix ? 'pr-10' : ''}"
				onblur={() => validate(key)}
				oninput={key === 'location' ? () => void refreshCost() : undefined}
				onchange={key === 'location' ? () => void refreshCost() : undefined}
			/>
			{#if opts.suffix}
				<span
					class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-base text-muted-foreground"
					aria-hidden="true">{opts.suffix}</span
				>
			{/if}
		</div>
		{#if opts.helper}<p id={id(`${key}-help`)} class={helperCls}>{opts.helper}</p>{/if}
		{@render fieldError(key)}
	</div>
{/snippet}

<form
	bind:this={formEl}
	novalidate
	aria-labelledby={id('title')}
	class="flex min-w-0 flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6"
	data-buy-box-form
	onsubmit={(e) => {
		e.preventDefault();
		void save(true);
	}}
>
	<h2 id={id('title')} class="font-display text-heading font-semibold text-foreground">{title}</h2>

	<div class="grid gap-4 sm:grid-cols-2">
		<div class="grid min-w-0 content-start gap-2">
			<label for={id('name')} class={labelCls}>Name</label>
			<input
				id={id('name')}
				bind:this={nameEl}
				bind:value={f.name}
				type="text"
				autocomplete="off"
				aria-invalid={errors.name ? 'true' : undefined}
				aria-describedby={described('name')}
				class={inputCls}
				onblur={() => validate('name')}
			/>
			{@render fieldError('name')}
		</div>
		{@render textField('location', 'Location', {
			helper: 'A city and state, like Austin, TX, or a 5-digit ZIP.'
		})}
		{@render textField('minPrice', 'Minimum price', { inputmode: 'decimal', prefix: '$' })}
		{@render textField('maxPrice', 'Maximum price', { inputmode: 'decimal', prefix: '$' })}
	</div>

	<fieldset class={fieldset}>
		<legend class={legendCls}>Bedrooms</legend>
		<div class="flex flex-wrap gap-2">
			{#each BEDS as option (option.value)}
				<label class={choice}>
					<input
						type="radio"
						name={id('beds')}
						value={option.value}
						bind:group={f.minBeds}
						class="size-4 accent-foreground"
					/>
					{option.label}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset class={fieldset} aria-describedby={id('types-help')}>
		<legend class={legendCls}>Property types</legend>
		<p id={id('types-help')} class="mb-2 {helperCls}">Leave all unchecked to include every type.</p>
		<div class="flex flex-wrap gap-2">
			{#each BUY_BOX_PROPERTY_TYPES as type (type)}
				<label class={choice}>
					<input
						type="checkbox"
						value={type}
						bind:group={f.propertyTypes}
						class="size-4 accent-foreground"
					/>
					{PROPERTY_TYPE_LABELS[type]}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset class={fieldset}>
		<legend class={legendCls}>Your targets (optional)</legend>
		<div class="grid gap-4 sm:grid-cols-2">
			{@render textField('minCapRate', 'Minimum estimated cap rate', {
				inputmode: 'decimal',
				suffix: '%'
			})}
			{@render textField('minRentToPrice', 'Minimum rent-to-price', {
				inputmode: 'decimal',
				suffix: '%',
				helper: '1% is the 1% rule.'
			})}
			{@render textField('expensePct', 'Expense assumption', {
				inputmode: 'decimal',
				suffix: '%',
				helper: 'Share of rent set aside for operating expenses in quick metrics. Starts at 40%.'
			})}
		</div>
	</fieldset>

	{#if saveFailed}
		<SectionError
			title="Couldn't save this buy box"
			body="Your entries are still here. Try again, or download a backup from Settings if this keeps happening."
		/>
	{/if}

	<div class="flex flex-wrap items-center gap-2 sm:gap-4">
		<Button
			type="submit"
			class="h-auto min-h-11 max-w-full shrink py-2 text-left whitespace-normal"
			aria-disabled={saving ? 'true' : undefined}
		>
			{#if saving === 'check'}
				<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
				Saving…
			{:else}
				Save and check now <CostLabel estimate={cost} />
			{/if}
		</Button>
		<Button
			variant="outline"
			aria-disabled={saving ? 'true' : undefined}
			onclick={() => void save(false)}
		>
			{saving === 'only' ? 'Saving…' : 'Save only'}
		</Button>
		<Button variant="ghost" onclick={onCancel}>Cancel</Button>
	</div>
</form>
