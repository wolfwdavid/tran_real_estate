<script lang="ts">
	// The deal analyzer (07-12, INV-01 / INV-02 manual half / INV-03 save half; 07-UI-SPEC "Analyzer
	// layout"). Five fieldsets of 07-10 inputs, the live ResultsPanel, working-draft autosave, Save
	// deal / Save changes / Save as a new deal, Try a sample deal and Clear analysis.
	//
	// Spend rule: this page never touches the data gateway. Results are $derived from the typed
	// numbers, the only $effect writes the Dexie draft, and Save writes the deals table. The autofill
	// controls (07-15) render into the `purchaseAutofill` / `incomeAutofill` slots of fieldsets 2
	// and 4; they must spend only from their own click handlers.
	//
	// The route reads `?id=` / `?sample=1` in its onMount and calls open(); prerendered HTML is the
	// empty analyzer.
	import { tick, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import Eraser from '@lucide/svelte/icons/eraser';
	import { parseMoneyInput } from '@tran/core/finance';
	import { NOT_AVAILABLE, usd } from '@tran/core/format';
	import {
		announce,
		Button,
		buttonVariants,
		ConfirmDialog
	} from '$lib/features/shared/data/platform-ui';
	import { formatRelative } from '$lib/features/shared/data/relative-time';
	import NotFoundPanel from '$lib/features/shared/NotFoundPanel.svelte';
	import SectionError from '$lib/features/shared/settings/SectionError.svelte';
	import { requestPersistence } from '$lib/storage/persistence';
	import { createDeal, getDeal, updateDeal } from '../deals/dealsRepo';
	import type { DealSources, FieldSourceKey } from '../deals/schema';
	import { AnalyzerPageState } from './analyzer-page.svelte';
	import { markEdited, type AutofillContext } from './autofill';
	import { dealName, formToDealData } from './deal-data';
	import { clearDraft, createAutosaver, readDraft, writeDraft } from './draftRepo';
	import ExpenseLines from './ExpenseLines.svelte';
	import FieldSource from './FieldSource.svelte';
	import {
		bpsToText,
		centsToText,
		FIELD_ERROR_COPY,
		type AnalyzerForm,
		type FieldKey
	} from './form-model';
	import MoneyInput from './MoneyInput.svelte';
	import NumberInput from './NumberInput.svelte';
	import PercentInput from './PercentInput.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import { sampleDealCopy } from './sample-deal';
	import UnitToggle from './UnitToggle.svelte';

	interface Props {
		/** 07-15: "Autofill value estimate" control, end of the Purchase fieldset. */
		purchaseAutofill?: Snippet<[AnalyzerPageState, AutofillContext]>;
		/** 07-15: "Autofill rent estimate" control, end of the Income fieldset. */
		incomeAutofill?: Snippet<[AnalyzerPageState, AutofillContext]>;
	}

	let { purchaseAutofill, incomeAutofill }: Props = $props();

	const s = new AnalyzerPageState();
	const autosaver = createAutosaver(writeDraft);
	s.startAutosave(autosaver);

	let results = $state<ResultsPanel | null>(null);
	let nameEl = $state<HTMLInputElement | null>(null);
	let notFound = $state(false);
	let saving = $state(false);
	let saveFailed = $state(false);
	let justSaved = $state(false);
	let clearOpen = $state(false);
	/** Set by a confirmed Clear so the dialog's close focus goes to Deal name, not the trigger. */
	let clearedJustNow = false;
	/** The open deal's name as last saved (Clear analysis body). */
	let savedName = $state('');
	let now = $state(Date.now());
	/** 07-15: set when autofill is pressed without an address; cleared by typing an address. */
	let addressError = $state(false);
	let addressEl = $state<HTMLInputElement | null>(null);

	const autofillCtx: AutofillContext = {
		addressMissing: () => {
			addressError = true;
			void tick().then(() => addressEl?.focus());
		}
	};

	/** Input ids whose filled value carries a FieldSource chip (07-15). */
	const SOURCE_KEYS: Record<string, FieldSourceKey> = {
		rent: 'rent',
		price: 'price',
		address: 'address',
		'property-type': 'propertyType',
		bedrooms: 'bedrooms',
		bathrooms: 'bathrooms',
		'square-feet': 'squareFeet'
	};

	/** The user typed into a filled field: its chip becomes "Edited by you" (07-15). */
	function onFormInput(e: Event) {
		const id = (e.target as HTMLElement | null)?.id ?? '';
		if (id === 'address' && addressError && s.form.address.trim() !== '') addressError = false;
		const key = SOURCE_KEYS[id];
		if (key) {
			const next = markEdited(s.sources, key);
			if (next !== s.sources) s.sources = next;
		}
	}

	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(id);
	});

	const err = (key: FieldKey) => {
		const e = s.shownErrors[key];
		return e ? FIELD_ERROR_COPY[e] : null;
	};
	const rentCents = $derived.by(() => {
		const r = parseMoneyInput(s.form.rent);
		return r.ok ? r.value : null;
	});
	const headlineText = () => {
		const cf = s.analysis?.cashFlowMonthly;
		return cf === null || cf === undefined ? NOT_AVAILABLE : usd(cf);
	};
	const savedRelative = $derived(
		s.savedAt ? formatRelative(Date.parse(s.savedAt), Math.max(now, Date.parse(s.savedAt))) : ''
	);

	const analyzePath = () => resolve('/investor/analyze/');
	function setUrl(id: string | null) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus this page's own ?id=
		replaceState(id ? `${analyzePath()}?id=${encodeURIComponent(id)}` : analyzePath(), page.state);
	}

	// ------------------------------------------------------------------ open (route onMount)

	/** Restore from the URL: ?sample=1 fills the sample, ?id= opens a saved deal, else the draft. */
	export async function open(params: URLSearchParams): Promise<void> {
		try {
			const id = params.get('id');
			if (params.get('sample') === '1') {
				s.restored = true;
				await trySample();
				setUrl(null);
				return;
			}
			if (id) {
				const deal = await getDeal(id);
				if (!deal) {
					notFound = true;
					return;
				}
				const draft = await readDraft();
				if (draft && draft.dealId === id) {
					// Unsaved typing on this deal survives a reload.
					s.load(draft.form, draft.sources);
					s.dealId = id;
					s.savedSnapshot = draft.savedSnapshot;
					s.savedAt = deal.updatedAt;
				} else {
					s.openDeal(deal);
				}
				savedName = deal.name;
				announce(`${deal.name} opened. Monthly cash flow: ${headlineText()}.`);
				return;
			}
			const draft = await readDraft();
			if (!draft || s.unsaved) return;
			s.load(draft.form, draft.sources);
			if (draft.dealId) {
				const deal = await getDeal(draft.dealId);
				if (deal) {
					s.dealId = deal.id;
					s.savedSnapshot = draft.savedSnapshot;
					s.savedAt = deal.updatedAt;
					savedName = deal.name;
					setUrl(deal.id);
				}
			}
		} catch {
			// Storage unavailable: start with an empty analysis; typing still works.
		} finally {
			s.restored = true;
		}
	}

	// ------------------------------------------------------------------ actions

	async function trySample(): Promise<void> {
		const sample = sampleDealCopy();
		s.reset();
		s.load(sample.form, sample.sources);
		if (new URL(location.href).searchParams.has('id')) setUrl(null);
		await tick();
		results?.focusHeading();
		announce(`Sample deal filled in. Monthly cash flow: ${headlineText()}.`);
	}

	function focusField(id: string) {
		document.getElementById(id)?.focus();
	}

	async function save(asNew: boolean): Promise<void> {
		if (saving) return;
		saveFailed = false;
		if (!s.validateAll()) {
			await tick();
			document.querySelector<HTMLElement>('#analyzer-form [aria-invalid="true"]')?.focus();
			return;
		}
		const data = formToDealData(
			$state.snapshot(s.form) as AnalyzerForm,
			$state.snapshot(s.sources) as DealSources
		);
		if (!data) {
			focusField(rentCents === null && s.form.price.trim() !== '' ? 'rent' : 'price');
			announce('Enter a purchase price and monthly rent before saving.');
			return;
		}
		saving = true;
		const wasOpen = s.dealId;
		try {
			const rec = asNew || !wasOpen ? await createDeal(data) : await updateDeal(wasOpen, data);
			if (!wasOpen) void requestPersistence().catch(() => undefined);
			s.markSaved(rec);
			savedName = rec.name;
			justSaved = true;
			setUrl(rec.id);
			await autosaver.flush();
			announce(
				asNew && wasOpen
					? `Saved as a new deal: ${rec.name}.`
					: wasOpen
						? 'Changes saved.'
						: `Deal saved: ${rec.name}.`
			);
		} catch {
			saveFailed = true;
		} finally {
			saving = false;
		}
	}

	async function clearAnalysis(): Promise<void> {
		autosaver.cancel();
		await clearDraft();
		s.reset();
		addressError = false;
		notFound = false;
		justSaved = false;
		saveFailed = false;
		savedName = '';
		clearedJustNow = true;
		setUrl(null);
		announce('Analysis cleared.');
	}

	function focusNameAfterClear(e: Event) {
		if (!clearedJustNow) return;
		clearedJustNow = false;
		e.preventDefault();
		nameEl?.focus();
	}

	const clearBody = $derived([
		"This empties every field and resets expense lines to their starting assumptions. Your saved deals aren't affected.",
		...(s.dealId ? [`${savedName || dealName(s.form)} stays saved as it was last saved.`] : [])
	]);

	// ------------------------------------------------------------------ closing-cost unit

	function switchClosing(to: 'pct' | 'usd') {
		const a = s.analysis;
		const price = s.parsed.inputs?.priceCents ?? 0;
		if (!a || price <= 0 || s.shownErrors.closing || s.parsed.errors.closing) return;
		s.form.closingAmount =
			to === 'usd'
				? centsToText(a.closingCents)
				: bpsToText(Math.round((a.closingCents * 10_000) / price));
	}

	function setFinancing(kind: 'mortgage' | 'cash') {
		s.form.financing = kind;
		if (kind === 'cash') {
			const next = { ...s.shownErrors };
			delete next.downPct;
			delete next.rate;
			delete next.termYears;
			s.shownErrors = next;
		}
	}

	$effect(() => {
		// Write the pending draft before the page goes away (reload, close, navigation).
		const flush = () => void autosaver.flush();
		window.addEventListener('pagehide', flush);
		return () => {
			window.removeEventListener('pagehide', flush);
			flush();
		};
	});

	const fieldset = 'm-0 min-w-0 rounded-lg border border-border bg-card p-4 sm:p-6';
	const legend = 'float-left mb-4 w-full font-display text-heading font-semibold text-foreground';
	const grid = 'clear-both grid gap-4 sm:grid-cols-2';
	const labelCls = 'text-base leading-[1.6] font-semibold text-foreground';
	const helperCls = 'text-label text-muted-foreground';
	const textInput =
		'h-12 w-full min-w-0 rounded-md border border-input bg-card px-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
	const inlineLink =
		'inline-flex min-h-11 items-center text-base leading-[1.6] font-semibold text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
	const CLOSING_UNITS = [
		{ value: 'pct', label: '% of price' },
		{ value: 'usd', label: '$' }
	] as const;
</script>

{#snippet priceChip()}<FieldSource source={s.sources.price} />{/snippet}
{#snippet rentChip()}<FieldSource source={s.sources.rent} />{/snippet}

{#if notFound}
	<div class="mt-8">
		<NotFoundPanel
			title="We couldn't find that deal in this browser"
			body="It may have been deleted, or saved in another browser. Deals are stored only where you saved them."
			href={resolve('/investor/deals/')}
			linkLabel="Back to saved deals"
		/>
	</div>
{:else}
	<p class="mt-4 max-w-prose text-base leading-[1.6] text-foreground">
		Enter the numbers you know. Autofill rent and value estimates from RentCast if you want them,
		after you see what the lookup costs.
	</p>
	<a href="#results" class="lg:hidden {inlineLink}">Jump to results</a>

	<div class="mt-6 flex flex-wrap items-center gap-2 sm:gap-4" data-action-row>
		<Button onclick={() => save(false)} aria-disabled={saving ? 'true' : undefined}>
			{saving ? 'Saving…' : s.dealId && s.unsaved ? 'Save changes' : 'Save deal'}
		</Button>
		{#if s.dealId}
			<Button variant="outline" onclick={() => save(true)}>Save as a new deal</Button>
			{#if !s.unsaved}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus the deal's ?id= -->
				<a
					href={`${resolve('/investor/memo/')}?id=${encodeURIComponent(s.dealId)}`}
					class={buttonVariants({ variant: 'outline' })}>Draft a memo</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		{/if}
		<ConfirmDialog
			bind:open={clearOpen}
			title="Clear this analysis?"
			body={clearBody}
			confirmLabel="Clear analysis"
			confirmBusyLabel="Clearing…"
			cancelLabel="Keep my numbers"
			onConfirm={clearAnalysis}
			onCloseAutoFocus={focusNameAfterClear}
		>
			{#snippet trigger({ props })}
				<Button {...props} variant="ghost">
					<Eraser size={16} aria-hidden="true" />
					Clear analysis
				</Button>
			{/snippet}
		</ConfirmDialog>
		{#if s.unsaved}
			<span
				class="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-label font-semibold text-muted-foreground"
				data-save-status><CircleDot size={14} aria-hidden="true" />Unsaved changes</span
			>
		{:else if s.dealId}
			<span class="inline-flex flex-wrap items-center gap-2" data-save-status>
				<span
					class="inline-flex items-center gap-1 rounded-full bg-secondary-surface px-2 py-1 text-label font-semibold text-secondary"
					><CircleCheck size={14} aria-hidden="true" />Saved</span
				>
				{#if savedRelative}<span class={helperCls}>Saved {savedRelative}</span>{/if}
			</span>
		{/if}
	</div>
	{#if justSaved && !s.unsaved}
		<p class="mt-2 text-label text-foreground">Saved to your deals.</p>
	{/if}
	{#if saveFailed}
		<SectionError
			class="mt-4"
			title="Couldn't save this deal"
			body="Your numbers are still here. Try again, or download a backup from Settings if this keeps happening."
		/>
	{/if}

	<div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_384px]">
		<form
			id="analyzer-form"
			novalidate
			class="grid min-w-0 scroll-mt-4 gap-8"
			data-restored={s.restored ? 'true' : undefined}
			oninput={onFormInput}
			onsubmit={(e) => e.preventDefault()}
		>
			<fieldset class={fieldset}>
				<legend class={legend}>Property</legend>
				<div class={grid}>
					<div class="grid min-w-0 gap-2 sm:col-span-2">
						<label for="deal-name" class={labelCls}>Deal name</label>
						<input
							id="deal-name"
							bind:this={nameEl}
							bind:value={s.form.name}
							type="text"
							autocomplete="off"
							aria-describedby="deal-name-help"
							class={textInput}
						/>
						<p id="deal-name-help" class={helperCls}>
							Shown in your saved deals. Leave it blank to use the address.
						</p>
					</div>
					<div class="grid min-w-0 gap-2 sm:col-span-2">
						<label for="address" class={labelCls}>Address</label>
						<input
							id="address"
							bind:this={addressEl}
							bind:value={s.form.address}
							type="text"
							autocomplete="street-address"
							aria-invalid={addressError ? 'true' : undefined}
							aria-describedby={addressError ? 'address-help address-error' : 'address-help'}
							class="{textInput} {addressError ? 'border-destructive' : ''}"
						/>
						<p id="address-help" class={helperCls}>Needed only for autofill.</p>
						{#if addressError}
							<p id="address-error" class="flex items-center gap-1 text-label text-destructive">
								<CircleAlert class="size-4 shrink-0" aria-hidden="true" />Enter the property address
								to look up an estimate.
							</p>
						{/if}
					</div>
					<div class="grid min-w-0 gap-2">
						<label for="property-type" class={labelCls}>Property type</label>
						<div class="relative">
							<select
								id="property-type"
								bind:value={s.form.propertyType}
								class="h-12 w-full min-w-0 cursor-pointer touch-manipulation appearance-none rounded-md border border-input bg-card pr-12 pl-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
							>
								<option value="">Choose a type</option>
								<option value="single-family">Single family</option>
								<option value="condo">Condo</option>
								<option value="townhouse">Townhouse</option>
								<option value="multi-family">Multi-family</option>
								<option value="manufactured">Manufactured</option>
							</select>
							<ChevronDown
								class="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
								aria-hidden="true"
							/>
						</div>
					</div>
					<NumberInput
						id="bedrooms"
						label="Bedrooms"
						integer
						bind:value={s.form.bedrooms}
						error={err('bedrooms')}
						onvalidate={() => s.validate('bedrooms')}
					/>
					<NumberInput
						id="bathrooms"
						label="Bathrooms"
						bind:value={s.form.bathrooms}
						error={err('bathrooms')}
						onvalidate={() => s.validate('bathrooms')}
					/>
					<NumberInput
						id="square-feet"
						label="Square feet"
						integer
						helper="Optional. Improves estimates."
						bind:value={s.form.squareFeet}
						error={err('squareFeet')}
						onvalidate={() => s.validate('squareFeet')}
					/>
				</div>
			</fieldset>

			<fieldset class={fieldset}>
				<legend class={legend}>Purchase</legend>
				<div class={grid}>
					<MoneyInput
						id="price"
						label="Purchase price"
						bind:value={s.form.price}
						error={err('price')}
						chip={s.sources.price ? priceChip : undefined}
						onvalidate={() => s.validate('price')}
					/>
					<div class="grid min-w-0 gap-2">
						{#if s.form.closingUnit === 'pct'}
							<PercentInput
								id="closing"
								label="Closing costs"
								bind:value={s.form.closingAmount}
								error={err('closing')}
								onvalidate={() => s.validate('closing')}
							/>
						{:else}
							<MoneyInput
								id="closing"
								label="Closing costs"
								bind:value={s.form.closingAmount}
								error={err('closing')}
								onvalidate={() => s.validate('closing')}
							/>
						{/if}
						<UnitToggle
							name="closing-unit"
							legend="Closing costs entered as"
							options={CLOSING_UNITS}
							bind:value={s.form.closingUnit}
							onchange={switchClosing}
						/>
					</div>
					<MoneyInput
						id="repairs"
						label="Repairs before renting"
						bind:value={s.form.repairs}
						error={err('repairs')}
						onvalidate={() => s.validate('repairs')}
					/>
				</div>
				{#if purchaseAutofill}<div class="mt-4">
						{@render purchaseAutofill(s, autofillCtx)}
					</div>{/if}
			</fieldset>

			<fieldset class={fieldset}>
				<legend class={legend}>Financing</legend>
				<div class="clear-both grid gap-4">
					<fieldset class="m-0 min-w-0 border-0 p-0">
						<legend class="mb-2 {labelCls}">How you're paying</legend>
						<div class="flex flex-wrap gap-2">
							{#each [{ value: 'mortgage', label: 'Mortgage' }, { value: 'cash', label: 'All cash' }] as const as option (option.value)}
								<label
									class="inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 rounded-md border border-input px-4 text-base leading-[1.6] text-foreground has-[input:checked]:font-semibold has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring"
								>
									<input
										type="radio"
										name="financing"
										value={option.value}
										checked={s.form.financing === option.value}
										onchange={() => setFinancing(option.value)}
										class="size-4 accent-foreground"
									/>
									{option.label}
								</label>
							{/each}
						</div>
					</fieldset>
					{#if s.form.financing === 'mortgage'}
						<div class="grid gap-4 sm:grid-cols-2">
							<PercentInput
								id="down-pct"
								label="Down payment"
								bind:value={s.form.downPct}
								error={err('downPct')}
								onvalidate={() => s.validate('downPct')}
							/>
							<PercentInput
								id="rate"
								label="Interest rate"
								helper="Use the rate from your lender quote."
								bind:value={s.form.rate}
								error={err('rate')}
								onvalidate={() => s.validate('rate')}
							/>
							<NumberInput
								id="term"
								label="Loan term"
								suffix="years"
								integer
								bind:value={s.form.termYears}
								error={err('termYears')}
								onvalidate={() => s.validate('termYears')}
							/>
						</div>
					{:else}
						<p class="text-base leading-[1.6] text-foreground">
							No loan, so there's no loan payment and no DSCR.
						</p>
					{/if}
				</div>
			</fieldset>

			<fieldset class={fieldset}>
				<legend class={legend}>Income</legend>
				<div class={grid}>
					<MoneyInput
						id="rent"
						label="Monthly rent"
						bind:value={s.form.rent}
						error={err('rent')}
						chip={s.sources.rent ? rentChip : undefined}
						onvalidate={() => s.validate('rent')}
					/>
					<MoneyInput
						id="other-income"
						label="Other monthly income"
						helper="Parking, laundry, storage, and similar."
						bind:value={s.form.otherIncome}
						error={err('otherIncome')}
						onvalidate={() => s.validate('otherIncome')}
					/>
				</div>
				{#if incomeAutofill}<div class="mt-4">{@render incomeAutofill(s, autofillCtx)}</div>{/if}
			</fieldset>

			<fieldset class={fieldset} aria-describedby="expense-note">
				<legend class={legend}>Operating expenses</legend>
				<div class="clear-both">
					<ExpenseLines
						bind:form={s.form.expenses}
						analysis={s.analysis}
						{rentCents}
						errors={s.shownErrors}
						onvalidate={(key) => s.validate(key)}
					/>
				</div>
			</fieldset>
		</form>

		<div class="min-w-0">
			<ResultsPanel
				bind:this={results}
				analysis={s.analysis}
				inputs={s.parsed.inputs}
				masked={s.parsed.masked}
				form={s.form}
				onsample={() => void trySample()}
				onfocusfield={focusField}
			/>
		</div>
	</div>
{/if}
