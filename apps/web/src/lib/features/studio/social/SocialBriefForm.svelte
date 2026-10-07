<script lang="ts">
	// 09-UI-SPEC "SocialBriefForm" (STU-02): one fieldset card with, in order, the post type chips,
	// the optional listing description source, the brief (the only source of numbers the posts may
	// use), the place for hashtags, the optional link and the tone chips.
	//
	// <form novalidate>: Enter never submits; only the panel's run control does, through the
	// host's validate(). Errors use the Phase 3 invalid pattern (aria-invalid, icon plus words,
	// linked by aria-describedby). Choosing a listing description hands its id to the host, which
	// copies the description text (never the disclosure) into the brief.
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import NativeSelect from '$lib/features/agent/ui/NativeSelect.svelte';
	import InputFairHousingNote from '../InputFairHousingNote.svelte';
	import {
		BRIEF_MAX,
		CITY_MAX,
		LINK_MAX,
		firstInvalidKey,
		isValidLink,
		socialFieldId,
		validateSocialForm,
		type SocialForm,
		type SocialFormErrors,
		type SocialFormKey
	} from './social-form';

	let {
		form = $bindable(),
		listingOptions = [],
		onsource
	}: {
		form: SocialForm;
		/** The 20 most recent listing descriptions: value = artifact id. */
		listingOptions?: readonly { value: string; label: string }[];
		/** A listing description was chosen (never called for "Don't use one"). */
		onsource?: (artifactId: string) => void;
	} = $props();

	let errors = $state<SocialFormErrors>({});

	/** Validates every field and shows every error (the run control). */
	export function validate(): { ok: boolean; firstInvalidId: string | null } {
		const next = validateSocialForm(form);
		errors = next;
		const key = firstInvalidKey(next);
		return { ok: key === null, firstInvalidId: key ? socialFieldId(key) : null };
	}

	export function clearErrors(): void {
		errors = {};
	}

	/** The form's first field (after Use a sample brief / Clear brief). */
	export function focusFirst(): void {
		document.getElementById(`social-post-type-${form.postType}`)?.focus();
	}

	function clearError(key: SocialFormKey): void {
		if (errors[key] === undefined) return;
		const next = { ...errors };
		delete next[key];
		errors = next;
	}

	/** Blur on the link: a format error only, never "required" (the link is optional). */
	function blurLink(): void {
		if (isValidLink(form.link)) clearError('link');
		else errors = { ...errors, link: validateSocialForm(form).link };
	}

	/** Blur on the brief: only the too-long error (an empty brief is reported by the run control). */
	function blurBrief(): void {
		const e = validateSocialForm(form).brief;
		if (e !== undefined && form.brief.trim() !== '') errors = { ...errors, brief: e };
		else if (e === undefined) clearError('brief');
	}

	const POST_TYPES = [
		{ value: 'just-listed', label: 'Just listed' },
		{ value: 'open-house', label: 'Open house' },
		{ value: 'price-change', label: 'Price change' },
		{ value: 'market-update', label: 'Market update' },
		{ value: 'other', label: 'Something else' }
	] as const;
	const TONES = [
		{ value: 'warm', label: 'Warm' },
		{ value: 'concise', label: 'Concise' },
		{ value: 'luxury', label: 'Luxury' }
	] as const;

	const sourceOptions = $derived([{ value: '', label: "Don't use one" }, ...listingOptions]);
	const COUNT = new Intl.NumberFormat('en-US');
	const briefCount = $derived(`${COUNT.format(form.brief.length)} of ${COUNT.format(BRIEF_MAX)}`);

	const BRIEF_HELP =
		'The facts to share, like "3 bedrooms, updated kitchen, open house Saturday 1 to 3." Only numbers you write here can appear in the posts.';
	const CITY_HELP =
		'Hashtags use this place name, the property type, and general real estate tags. Never people.';
	const LINK_HELP =
		"Added to Facebook and LinkedIn. Instagram captions don't make links clickable, so that post points to the link in your bio.";

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
		'flex min-w-0 flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6';
	const legendCls = 'float-left w-full font-display text-heading font-semibold text-foreground';
	const groupLegendCls = 'text-base leading-[1.6] font-semibold text-foreground';
	const labelCls = 'text-base leading-[1.6] font-semibold text-foreground';
	const helperCls = 'text-label text-muted-foreground';
	const inputCls = (invalid: boolean) =>
		`h-12 w-full min-w-0 rounded-md border bg-card px-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${invalid ? 'border-destructive' : 'border-input'}`;

	const describe = (...ids: (string | false | undefined)[]) =>
		ids.filter(Boolean).join(' ') || undefined;

	const BRIEF_ID = socialFieldId('brief');
	const CITY_ID = socialFieldId('cityOrArea');
	const LINK_ID = socialFieldId('link');
	const SOURCE_ID = socialFieldId('source');
</script>

{#snippet errorLine(key: SocialFormKey)}
	{#if errors[key]}
		<p id="{socialFieldId(key)}-error" class="flex items-start gap-1 text-label text-destructive">
			<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			{errors[key]}
		</p>
	{/if}
{/snippet}

<form novalidate class="flex flex-col" onsubmit={(e) => e.preventDefault()} data-social-brief>
	<fieldset class={cardCls}>
		<legend class={legendCls}>Your post</legend>

		<fieldset class="min-w-0">
			<legend class={groupLegendCls}>What's the post about?</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each POST_TYPES as option (option.value)}
					{@const checked = form.postType === option.value}
					<label class={chip(checked)}>
						<input
							id="social-post-type-{option.value}"
							type="radio"
							name="socialPostType"
							class={HIDDEN_INPUT}
							value={option.value}
							{checked}
							onchange={() => (form.postType = option.value)}
						/>
						{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
						{option.label}
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="grid min-w-0 gap-2">
			<NativeSelect
				id={SOURCE_ID}
				label="Start from a listing description (optional)"
				bind:value={form.source}
				options={sourceOptions}
				describedby={listingOptions.length === 0 ? `${SOURCE_ID}-help` : undefined}
				onchange={(v) => {
					if (v !== '') onsource?.(v);
				}}
			/>
			{#if listingOptions.length === 0}
				<p id="{SOURCE_ID}-help" class={helperCls}>
					Listing descriptions you write in the Studio appear here.
				</p>
			{/if}
		</div>

		<div class="grid min-w-0 gap-2">
			<label for={BRIEF_ID} class={labelCls}>Your brief</label>
			<textarea
				id={BRIEF_ID}
				name="brief"
				bind:value={form.brief}
				oninput={() => clearError('brief')}
				onblur={blurBrief}
				aria-invalid={errors.brief ? 'true' : undefined}
				aria-describedby={describe(
					`${BRIEF_ID}-help`,
					`${BRIEF_ID}-count`,
					!!errors.brief && `${BRIEF_ID}-error`,
					`${BRIEF_ID}-fh`
				)}
				class="min-h-40 w-full min-w-0 rounded-md border bg-card px-4 py-3 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring {errors.brief
					? 'border-destructive'
					: 'border-input'}"></textarea>
			<div class="flex flex-wrap justify-between gap-2">
				<p id="{BRIEF_ID}-help" class="max-w-reading {helperCls}">{BRIEF_HELP}</p>
				<p id="{BRIEF_ID}-count" class="{helperCls} tabular-nums" aria-live="off">
					{briefCount}
				</p>
			</div>
			{@render errorLine('brief')}
			<InputFairHousingNote text={form.brief} id="{BRIEF_ID}-fh" />
		</div>

		<div class="grid min-w-0 gap-2">
			<label for={CITY_ID} class={labelCls}>City or area for hashtags</label>
			<input
				id={CITY_ID}
				name="cityOrArea"
				type="text"
				autocomplete="off"
				maxlength={CITY_MAX}
				bind:value={form.cityOrArea}
				aria-describedby="{CITY_ID}-help"
				class={inputCls(false)}
			/>
			<p id="{CITY_ID}-help" class={helperCls}>{CITY_HELP}</p>
		</div>

		<div class="grid min-w-0 gap-2">
			<label for={LINK_ID} class={labelCls}>Link to include (optional)</label>
			<input
				id={LINK_ID}
				name="link"
				type="url"
				inputmode="url"
				autocomplete="url"
				maxlength={LINK_MAX}
				bind:value={form.link}
				oninput={() => clearError('link')}
				onblur={blurLink}
				aria-invalid={errors.link ? 'true' : undefined}
				aria-describedby={describe(`${LINK_ID}-help`, !!errors.link && `${LINK_ID}-error`)}
				class={inputCls(!!errors.link)}
			/>
			<p id="{LINK_ID}-help" class={helperCls}>{LINK_HELP}</p>
			{@render errorLine('link')}
		</div>

		<fieldset class="min-w-0">
			<legend class={groupLegendCls}>Tone</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each TONES as option (option.value)}
					{@const checked = form.tone === option.value}
					<label class={chip(checked)}>
						<input
							id="social-tone-{option.value}"
							type="radio"
							name="socialTone"
							class={HIDDEN_INPUT}
							value={option.value}
							{checked}
							onchange={() => (form.tone = option.value)}
						/>
						{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
						{option.label}
					</label>
				{/each}
			</div>
		</fieldset>
	</fieldset>
</form>
