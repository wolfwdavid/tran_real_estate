<script lang="ts" module>
	import { REEL_TEMPLATES, formatSlot, type BeatKey, type ReelLength } from '@tran/core/studio';
	import type { ReelBeats } from '../fixtures/sample-reel-beats';

	export type ReelForm = ReelBeats;
	export type ReelFieldKey = Exclude<keyof ReelForm, 'length'>;
	export type ReelFormErrors = Partial<Record<ReelFieldKey, string>>;

	export const BEAT_MAX = 300;
	export const CTA_MAX = 120;

	export interface BeatFieldRow {
		key: ReelFieldKey;
		beat: BeatKey;
		label: string;
		helper: string;
		/** Copy shown when a required beat is empty; undefined for the optional ones. */
		required?: string;
		max: number;
	}

	/** The six beats in script order, with the UI-SPEC labels, helpers and validation copy. */
	export const BEAT_FIELDS: readonly BeatFieldRow[] = [
		{
			key: 'hook',
			beat: 'hook',
			label: 'Hook (optional)',
			helper:
				'A first line that makes people stop scrolling. Leave it blank and Tran writes one from your story.',
			max: BEAT_MAX
		},
		{
			key: 'pain',
			beat: 'pain',
			label: 'The manual pain',
			helper: 'What was slow or frustrating before?',
			required: 'Describe the manual pain.',
			max: BEAT_MAX
		},
		{
			key: 'beforeAfter',
			beat: 'before_after',
			label: 'Before and after',
			helper: 'What changed in how you work, or how your clients are served?',
			required: 'Describe the before and after.',
			max: BEAT_MAX
		},
		{
			key: 'results',
			beat: 'results',
			label: 'Your results (optional)',
			helper:
				'Real outcomes you can show records for, like "Answered every inquiry within an hour last spring."',
			max: BEAT_MAX
		},
		{
			key: 'mission',
			beat: 'mission',
			label: 'Your mission',
			helper: 'Why you do this work.',
			required: 'Describe your mission.',
			max: BEAT_MAX
		},
		{
			key: 'cta',
			beat: 'cta',
			label: 'Call to action',
			helper: 'What should viewers do next, like "Send me a message to talk about your move."',
			required: 'Add a call to action.',
			max: CTA_MAX
		}
	];

	export const RESULTS_REMINDER =
		"Only include results you can back up with records. Made-up or exaggerated results can break advertising rules, and Tran won't add any for you.";

	export const LENGTH_OPTIONS: readonly { value: ReelLength; label: string }[] = [
		{ value: 30, label: '30 seconds' },
		{ value: 60, label: '60 seconds' }
	];

	export const reelFieldId = (key: ReelFieldKey | 'length'): string =>
		key === 'length'
			? 'reel-length-30'
			: `reel-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

	/** The code-owned slot for a beat at the chosen length ("0:00 to 0:03"). */
	export function slotFor(beat: BeatKey, length: ReelLength): string {
		const row = REEL_TEMPLATES[length].find(([k]) => k === beat);
		return row ? formatSlot(row[1], row[2]) : '';
	}

	export function emptyReelForm(): ReelForm {
		return { length: 30, hook: '', pain: '', beforeAfter: '', results: '', mission: '', cta: '' };
	}

	/** A stored form (autosave) back into a ReelForm; anything unexpected falls back to empty. */
	export function restoreReelForm(data: unknown): ReelForm {
		const out = emptyReelForm();
		if (data === null || typeof data !== 'object') return out;
		const d = data as Record<string, unknown>;
		if (d.length === 30 || d.length === 60) out.length = d.length;
		for (const { key, max } of BEAT_FIELDS) {
			const v = d[key];
			if (typeof v === 'string') out[key] = v.slice(0, max);
		}
		return out;
	}

	/** Same beats text (the length is a style choice, so it doesn't end the sample state). */
	export function sameStory(a: ReelForm, b: Readonly<ReelForm>): boolean {
		return BEAT_FIELDS.every(({ key }) => a[key] === b[key]);
	}

	/** Every error at once, in field order. */
	export function validateReelForm(form: ReelForm): ReelFormErrors {
		const errors: ReelFormErrors = {};
		for (const { key, required, max } of BEAT_FIELDS) {
			const value = form[key].trim();
			if (required && value === '') errors[key] = required;
			else if (value.length > max) errors[key] = `Keep this under ${max} characters.`;
		}
		return errors;
	}

	export function firstInvalidKey(errors: ReelFormErrors): ReelFieldKey | null {
		return BEAT_FIELDS.find(({ key }) => errors[key] !== undefined)?.key ?? null;
	}
</script>

<script lang="ts">
	// 09-UI-SPEC "Reel script" ReelBeatsForm (STU-03): one fieldset card, legend "Your story",
	// the Reel length chips and six beat textareas. Each label is followed by its code-owned time
	// slot for the chosen length; the model never sees or writes a time.
	//
	// <form novalidate>: Enter never submits; only the panel's run control does, through the
	// host's validate(). Blur shows the over-limit error only, never "required".
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Info from '@lucide/svelte/icons/info';
	import InputFairHousingNote from '../InputFairHousingNote.svelte';

	let { form = $bindable() }: { form: ReelForm } = $props();

	let errors = $state<ReelFormErrors>({});

	/** Validates every field and shows every error (the run control). */
	export function validate(): { ok: boolean; firstInvalidId: string | null } {
		errors = validateReelForm(form);
		const key = firstInvalidKey(errors);
		return { ok: key === null, firstInvalidId: key ? reelFieldId(key) : null };
	}

	export function clearErrors(): void {
		errors = {};
	}

	/** The form's first field: the selected Reel length chip. */
	export function focusFirst(): void {
		document.getElementById(`reel-length-${form.length}`)?.focus();
	}

	function changed(key: ReelFieldKey): void {
		if (errors[key] === undefined) return;
		const next = { ...errors };
		delete next[key];
		errors = next;
	}

	function blurCheck(key: ReelFieldKey, max: number): void {
		if (form[key].trim().length > max)
			errors = { ...errors, [key]: `Keep this under ${max} characters.` };
	}

	const chip = (checked: boolean) =>
		[
			'relative inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-1 rounded-full border px-4 text-base leading-[1.6]',
			'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring',
			checked
				? 'border-foreground bg-foreground font-semibold text-card'
				: 'border-input bg-card font-normal text-foreground'
		].join(' ');
	const HIDDEN_INPUT = 'absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0';
	const cardCls =
		'flex min-w-0 flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6';
	const legendCls = 'float-left w-full font-display text-heading font-semibold text-foreground';
	const labelCls = 'text-base leading-[1.6] font-semibold text-foreground';
	const helperCls = 'text-label text-muted-foreground';
	const describe = (...ids: (string | false | undefined)[]) =>
		ids.filter(Boolean).join(' ') || undefined;
</script>

<form novalidate class="flex flex-col gap-8" onsubmit={(e) => e.preventDefault()}>
	<fieldset class={cardCls} data-reel-beats-form>
		<legend class={legendCls}>Your story</legend>

		<fieldset class="min-w-0">
			<legend class={labelCls}>Reel length</legend>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each LENGTH_OPTIONS as option (option.value)}
					{@const checked = form.length === option.value}
					<label class={chip(checked)}>
						<input
							id="reel-length-{option.value}"
							type="radio"
							name="reelLength"
							class={HIDDEN_INPUT}
							value={option.value}
							{checked}
							onchange={() => (form.length = option.value)}
						/>
						{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
						{option.label}
					</label>
				{/each}
			</div>
		</fieldset>

		{#each BEAT_FIELDS as row (row.key)}
			{@const id = reelFieldId(row.key)}
			{@const invalid = errors[row.key] !== undefined}
			<div class="grid min-w-0 gap-2" data-reel-field={row.key}>
				<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<label for={id} class={labelCls}>{row.label}</label>
					<span id="{id}-slot" class="{helperCls} tabular-nums" data-reel-slot
						>{slotFor(row.beat, form.length)}</span
					>
				</div>
				<textarea
					{id}
					name={row.key}
					maxlength={row.max}
					bind:value={form[row.key]}
					oninput={() => changed(row.key)}
					onblur={() => blurCheck(row.key, row.max)}
					aria-invalid={invalid ? 'true' : undefined}
					aria-describedby={describe(
						`${id}-slot`,
						`${id}-help`,
						`${id}-count`,
						row.key === 'results' && `${id}-reminder`,
						invalid && `${id}-error`,
						`${id}-fh`
					)}
					class="min-h-24 w-full min-w-0 rounded-md border bg-card px-4 py-3 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring {invalid
						? 'border-destructive'
						: 'border-input'}"></textarea>
				<div class="flex flex-wrap justify-between gap-2">
					<p id="{id}-help" class={helperCls}>{row.helper}</p>
					<p id="{id}-count" class="{helperCls} tabular-nums" aria-live="off">
						{form[row.key].length} of {row.max}
					</p>
				</div>
				{#if row.key === 'results'}
					<p id="{id}-reminder" class="flex items-start gap-2 text-label text-foreground">
						<Info size={16} class="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
						<span>{RESULTS_REMINDER}</span>
					</p>
				{/if}
				{#if invalid}
					<p id="{id}-error" class="flex items-start gap-1 text-label text-destructive">
						<CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
						{errors[row.key]}
					</p>
				{/if}
				<InputFairHousingNote text={form[row.key]} id="{id}-fh" />
			</div>
		{/each}
	</fieldset>
</form>
