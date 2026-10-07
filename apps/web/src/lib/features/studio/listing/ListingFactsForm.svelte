<script lang="ts">
	// 09-UI-SPEC "ListingFactsForm" (STU-01): four fieldset cards (The home, Features, Nearby,
	// Style) that collect property facts only. There is no schools, worship, safety or
	// demographic field, and the form model can only produce the closed whitelist of
	// @tran/core/studio LISTING_FACT_KEYS.
	//
	// <form novalidate>: Enter never submits; only the panel's run control does, through the
	// host's validate(). Validation copy is the core validateListingFacts copy, shown with the
	// Phase 3 invalid pattern (aria-invalid, icon plus words, linked by aria-describedby).
	// Numeric fields are type="text" with an inputmode and format on blur (Phase 7); blur shows
	// format errors only, never "required" errors.
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import {
		LISTING_FEATURES,
		NEARBY_AMENITIES,
		PROPERTY_TYPES_STUDIO,
		type ListingFactErrors,
		type ListingFacts
	} from '@tran/core/studio';
	import NativeSelect from '$lib/features/agent/ui/NativeSelect.svelte';
	import InputFairHousingNote from '../InputFairHousingNote.svelte';
	import {
		fieldId,
		firstInvalidKey,
		formatNumberText,
		validateListingForm,
		type ListingFactKey,
		type ListingForm,
		type ListingNumberKey
	} from './listing-form';

	let {
		form = $bindable(),
		oninput
	}: {
		form: ListingForm;
		/** Any change the agent makes (typing, a chip, a select): the host drops the sample state. */
		oninput?: () => void;
	} = $props();

	let errors = $state<ListingFactErrors>({});

	const REQUIRED: ReadonlySet<ListingFactKey> = new Set([
		'listingType',
		'propertyType',
		'bedrooms',
		'bathrooms'
	]);

	/** Validates every field and shows every error (the run control). */
	export function validate(): {
		ok: boolean;
		firstInvalidId: string | null;
		facts: ListingFacts | null;
	} {
		const r = validateListingForm(form, new Date());
		if (r.ok) {
			errors = {};
			return { ok: true, firstInvalidId: null, facts: r.value };
		}
		errors = r.errors;
		const key = firstInvalidKey(r.errors);
		return { ok: false, firstInvalidId: key ? fieldId(key) : null, facts: null };
	}

	export function clearErrors(): void {
		errors = {};
	}

	/** The form's first field (after Fill with sample facts / Clear facts). */
	export function focusFirst(): void {
		document.getElementById(fieldId('listingType'))?.focus();
	}

	/** Blur: format errors only. An empty optional field clears its error; required stays. */
	function blurCheck(key: ListingFactKey): void {
		const raw = form[key as keyof ListingForm];
		const empty = typeof raw === 'string' ? raw.trim() === '' : false;
		const r = validateListingForm(form, new Date());
		const next = { ...errors };
		if (empty) {
			if (!REQUIRED.has(key)) delete next[key];
		} else if (!r.ok && r.errors[key]) next[key] = r.errors[key];
		else delete next[key];
		errors = next;
	}

	function changed(key: ListingFactKey): void {
		if (errors[key] !== undefined) {
			const next = { ...errors };
			delete next[key];
			errors = next;
		}
		oninput?.();
	}

	function blurNumber(key: ListingNumberKey): void {
		form[key] = formatNumberText(key, form[key]);
		blurCheck(key);
	}

	function toggle(list: 'features' | 'nearby', value: string, checked: boolean): void {
		const order: readonly string[] = list === 'features' ? LISTING_FEATURES : NEARBY_AMENITIES;
		const next = checked ? [...form[list], value] : form[list].filter((v) => v !== value);
		// Canonical UI order whatever the click order.
		form[list] = order.filter((v) => next.includes(v));
		changed(list);
	}

	const PROPERTY_OPTIONS = [
		{ value: '', label: 'Choose a property type' },
		...PROPERTY_TYPES_STUDIO.map((t) => ({ value: t, label: t }))
	];
	const LISTING_TYPES = [
		{ value: 'sale', label: 'For sale' },
		{ value: 'rent', label: 'For rent' }
	] as const;
	const TONES = [
		{ value: 'warm', label: 'Warm', description: 'Friendly and inviting.' },
		{ value: 'concise', label: 'Concise', description: 'Short sentences, just the facts.' },
		{ value: 'luxury', label: 'Luxury', description: 'Polished and detailed, without hype.' }
	] as const;
	const LENGTHS = [
		{ value: 'short', label: 'Short' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'long', label: 'Long' }
	] as const;

	const NEARBY_HELP =
		'Amenities only. Tran leaves out schools, houses of worship, safety, and descriptions of who lives nearby, because they can steer buyers or renters.';

	const priceLabel = $derived(form.listingType === 'rent' ? 'Monthly rent' : 'Price');
	const anythingCount = $derived(form.anythingElse.length);

	const chip = (checked: boolean) =>
		[
			'relative inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-1 rounded-full border px-4 text-base leading-[1.6]',
			'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring',
			checked
				? 'border-foreground bg-foreground font-semibold text-card'
				: 'border-input bg-card font-normal text-foreground'
		].join(' ');
	// The native control covers its chip invisibly: it stays the click and focus target.
	const HIDDEN_INPUT = 'absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0';

	const cardCls =
		'flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6';
	const legendCls = 'float-left w-full font-display text-heading font-semibold text-foreground';
	const groupLegendCls = 'text-base leading-[1.6] font-semibold text-foreground';
	const labelCls = 'text-base leading-[1.6] font-semibold text-foreground';
	const helperCls = 'text-label text-muted-foreground';
	const inputCls = (invalid: boolean) =>
		`h-12 w-full min-w-0 rounded-md border bg-card px-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${invalid ? 'border-destructive' : 'border-input'}`;

	const describe = (...ids: (string | false | undefined)[]) =>
		ids.filter(Boolean).join(' ') || undefined;
	const errId = (key: ListingFactKey) => `${fieldId(key)}-error`;
	const helpId = (key: ListingFactKey) => `${fieldId(key)}-help`;
	const fhId = (key: ListingFactKey) => `${fieldId(key)}-fh`;
</script>

{#snippet errorLine(key: ListingFactKey)}
	{#if errors[key]}
		<p id={errId(key)} class="flex items-start gap-1 text-label text-destructive">
			<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			{errors[key]}
		</p>
	{/if}
{/snippet}

{#snippet numberField(
	key: ListingNumberKey,
	label: string,
	mode: 'numeric' | 'decimal',
	opts: { hiddenUnit?: string; prefix?: string; helper?: string; wide?: boolean }
)}
	<div class="grid min-w-0 gap-2 {opts.wide ? 'sm:col-span-2' : ''}">
		<label for={fieldId(key)} class={labelCls}
			>{label}{#if opts.hiddenUnit}<span class="sr-only">{opts.hiddenUnit}</span>{/if}</label
		>
		<div class="relative">
			{#if opts.prefix}<span
					aria-hidden="true"
					class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base leading-[1.6] text-muted-foreground"
					>{opts.prefix}</span
				>{/if}
			<input
				id={fieldId(key)}
				name={key}
				type="text"
				inputmode={mode}
				autocomplete="off"
				bind:value={form[key]}
				oninput={() => oninput?.()}
				onblur={() => blurNumber(key)}
				aria-invalid={errors[key] ? 'true' : undefined}
				aria-describedby={describe(opts.helper && helpId(key), !!errors[key] && errId(key))}
				class="{inputCls(!!errors[key])} tabular-nums {opts.prefix ? 'pl-8' : ''}"
			/>
		</div>
		{#if opts.helper}<p id={helpId(key)} class={helperCls}>{opts.helper}</p>{/if}
		{@render errorLine(key)}
	</div>
{/snippet}

{#snippet textField(
	key: 'lotSize' | 'streetOrArea' | 'otherFeatures' | 'nearbyPlaces',
	label: string,
	max: number,
	opts: { helper?: string; wide?: boolean; fh?: boolean }
)}
	<div class="grid min-w-0 gap-2 {opts.wide ? 'sm:col-span-2' : ''}">
		<label for={fieldId(key)} class={labelCls}>{label}</label>
		<input
			id={fieldId(key)}
			name={key}
			type="text"
			autocomplete="off"
			maxlength={max}
			bind:value={form[key]}
			oninput={() => oninput?.()}
			onblur={() => blurCheck(key)}
			aria-invalid={errors[key] ? 'true' : undefined}
			aria-describedby={describe(
				opts.helper && helpId(key),
				!!errors[key] && errId(key),
				opts.fh && fhId(key)
			)}
			class={inputCls(!!errors[key])}
		/>
		{#if opts.helper}<p id={helpId(key)} class={helperCls}>{opts.helper}</p>{/if}
		{@render errorLine(key)}
		{#if opts.fh}<InputFairHousingNote text={form[key]} id={fhId(key)} />{/if}
	</div>
{/snippet}

<form novalidate class="flex flex-col gap-8" onsubmit={(e) => e.preventDefault()}>
	<fieldset class={cardCls}>
		<legend class={legendCls}>The home</legend>

		<fieldset
			class="min-w-0"
			aria-describedby={errors.listingType ? errId('listingType') : undefined}
		>
			<legend class={groupLegendCls}>Listing type</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each LISTING_TYPES as option (option.value)}
					{@const checked = form.listingType === option.value}
					<label class={chip(checked)}>
						<input
							id="listing-listing-type-{option.value}"
							type="radio"
							name="listingType"
							class={HIDDEN_INPUT}
							value={option.value}
							{checked}
							onchange={() => {
								form.listingType = option.value;
								changed('listingType');
							}}
						/>
						{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
						{option.label}
					</label>
				{/each}
			</div>
			<div class="mt-2">{@render errorLine('listingType')}</div>
		</fieldset>

		<div class="grid min-w-0 gap-2">
			<NativeSelect
				id={fieldId('propertyType')}
				label="Property type"
				bind:value={form.propertyType}
				options={PROPERTY_OPTIONS}
				invalid={!!errors.propertyType}
				describedby={errors.propertyType ? errId('propertyType') : undefined}
				onchange={() => changed('propertyType')}
			/>
			{@render errorLine('propertyType')}
		</div>

		<div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
			{@render numberField('bedrooms', 'Bedrooms', 'numeric', {})}
			{@render numberField('bathrooms', 'Bathrooms', 'decimal', {})}
			{@render numberField('squareFeet', 'Square feet', 'numeric', {})}
			{@render numberField('yearBuilt', 'Year built', 'numeric', {})}
			{@render textField('lotSize', 'Lot size', 40, { helper: 'For example, 0.25 acre.' })}
			{@render numberField('garageSpaces', 'Garage spaces', 'numeric', {})}
			{@render numberField('price', priceLabel, 'numeric', {
				hiddenUnit: ', in dollars',
				prefix: '$',
				wide: true
			})}
			{@render textField('streetOrArea', 'Street or area name', 80, {
				helper: 'Shown in the subject line and Draft history. Optional.',
				wide: true
			})}
		</div>
	</fieldset>

	<fieldset class={cardCls}>
		<legend class={legendCls}>Features</legend>
		<div class="flex flex-wrap gap-2">
			{#each LISTING_FEATURES as feature, i (feature)}
				{@const checked = form.features.includes(feature)}
				<label class={chip(checked)}>
					<input
						id="listing-features-{i}"
						type="checkbox"
						class={HIDDEN_INPUT}
						value={feature}
						{checked}
						onchange={(e) => toggle('features', feature, e.currentTarget.checked)}
					/>
					{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
					{feature}
				</label>
			{/each}
		</div>
		{@render errorLine('features')}
		{@render textField('otherFeatures', 'Other features (optional)', 200, {
			helper: 'Separate features with commas.',
			fh: true
		})}
	</fieldset>

	<fieldset class={cardCls} aria-describedby="listing-nearby-help">
		<legend class={legendCls}>Nearby</legend>
		<p id="listing-nearby-help" class={helperCls}>{NEARBY_HELP}</p>
		<div class="flex flex-wrap gap-2">
			{#each NEARBY_AMENITIES as amenity, i (amenity)}
				{@const checked = form.nearby.includes(amenity)}
				<label class={chip(checked)}>
					<input
						id="listing-nearby-{i}"
						type="checkbox"
						class={HIDDEN_INPUT}
						value={amenity}
						{checked}
						onchange={(e) => toggle('nearby', amenity, e.currentTarget.checked)}
					/>
					{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
					{amenity}
				</label>
			{/each}
		</div>
		{@render errorLine('nearby')}
		{@render textField('nearbyPlaces', 'Name nearby places (optional)', 200, {
			helper: 'For example, Riverside Park and the Main Street shops.',
			fh: true
		})}
	</fieldset>

	<fieldset class={cardCls}>
		<legend class={legendCls}>Style</legend>

		<fieldset class="min-w-0" aria-describedby="listing-tone-help">
			<legend class={groupLegendCls}>Tone</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each TONES as option (option.value)}
					{@const checked = form.tone === option.value}
					<label class={chip(checked)}>
						<input
							id="listing-tone-{option.value}"
							type="radio"
							name="tone"
							class={HIDDEN_INPUT}
							value={option.value}
							{checked}
							onchange={() => {
								form.tone = option.value;
								changed('tone');
							}}
						/>
						{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
						{option.label}
					</label>
				{/each}
			</div>
			<ul id="listing-tone-help" class="mt-2 flex flex-col gap-1 {helperCls}">
				{#each TONES as option (option.value)}
					<li><span class="font-semibold">{option.label}:</span> {option.description}</li>
				{/each}
			</ul>
		</fieldset>

		<fieldset class="min-w-0" aria-describedby="listing-length-help">
			<legend class={groupLegendCls}>Length</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each LENGTHS as option (option.value)}
					{@const checked = form.length === option.value}
					<label class={chip(checked)}>
						<input
							id="listing-length-{option.value}"
							type="radio"
							name="length"
							class={HIDDEN_INPUT}
							value={option.value}
							{checked}
							onchange={() => {
								form.length = option.value;
								changed('length');
							}}
						/>
						{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
						{option.label}
					</label>
				{/each}
			</div>
			<p id="listing-length-help" class="mt-2 {helperCls}">
				Short is about 75 words, Medium about 150, Long about 250.
			</p>
		</fieldset>

		<div class="grid min-w-0 gap-2">
			<label for={fieldId('anythingElse')} class={labelCls}
				>Anything else about the home (optional)</label
			>
			<textarea
				id={fieldId('anythingElse')}
				name="anythingElse"
				maxlength={500}
				bind:value={form.anythingElse}
				oninput={() => oninput?.()}
				onblur={() => blurCheck('anythingElse')}
				aria-invalid={errors.anythingElse ? 'true' : undefined}
				aria-describedby={describe(
					helpId('anythingElse'),
					`${fieldId('anythingElse')}-count`,
					!!errors.anythingElse && errId('anythingElse'),
					fhId('anythingElse')
				)}
				class="min-h-40 w-full min-w-0 rounded-md border bg-card px-4 py-3 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring {errors.anythingElse
					? 'border-destructive'
					: 'border-input'}"></textarea>
			<div class="flex flex-wrap justify-between gap-2">
				<p id={helpId('anythingElse')} class={helperCls}>
					Describe the home, not who should live there.
				</p>
				<p id="{fieldId('anythingElse')}-count" class="{helperCls} tabular-nums" aria-live="off">
					{anythingCount} of 500
				</p>
			</div>
			{@render errorLine('anythingElse')}
			<InputFairHousingNote text={form.anythingElse} id={fhId('anythingElse')} />
		</div>

		{@render numberField(
			'siteCharLimit',
			'Character limit for your listing site (optional)',
			'numeric',
			{
				helper: 'Only sets the counter below the draft.'
			}
		)}
	</fieldset>
</form>
