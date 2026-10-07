<script lang="ts">
	// One brand color row (AGT-01, UI-SPEC "Brand colors"): a native color picker and a hex text
	// field that mirror each other, a Clear button and the live ContrastVerdict from
	// @tran/brand/brand-color.
	// `value` (the draft's brandPrimary / brandAccent) only ever holds '' or a normalized #RRGGBB,
	// so an unfinished hex can never reach the profile store; the raw text lives here.
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import {
		BRAND_FALLBACK,
		FALLBACK_NAMES,
		assessBrandColor,
		normalizeHex,
		type BrandRole
	} from '@tran/brand/brand-color';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	interface Props {
		role: BrandRole;
		value: string;
	}

	let { role, value = $bindable() }: Props = $props();

	const COPY = {
		primary: {
			label: 'Primary color',
			help: 'Used for headings and buttons with white text on your reports.',
			pick: 'Pick primary color',
			swatch: 'bg-primary'
		},
		accent: {
			label: 'Accent color',
			help: 'Used for bands behind dark text on your reports.',
			pick: 'Pick accent color',
			swatch: 'bg-accent-surface'
		}
	} as const;
	const copy = $derived(COPY[role]);
	const fallbackName = $derived(FALLBACK_NAMES[role]);
	const roleTitle = $derived(role === 'primary' ? 'Primary' : 'Accent');
	const ANNOUNCE_DEBOUNCE_MS = 500;
	const HEX_ERROR = 'Use a 6-digit hex color, like #A4452A.';

	const hexId = $derived(`profile-brand-${role}`);
	const helpId = $derived(`${hexId}-help`);
	const errorId = $derived(`${hexId}-error`);
	const verdictId = $derived(`${hexId}-verdict`);

	let text = $state(value);
	let invalid = $state(false);

	// A saved profile arrives after mount (and Clear / the picker write `value`): mirror it into
	// the text field unless it already reads the same color.
	$effect(() => {
		const v = value;
		if (normalizeHex(text) !== (v || null) && !(v === '' && text === '')) {
			text = v;
			invalid = false;
		}
	});

	const assessment = $derived(assessBrandColor(value, role));
	const verdict = $derived.by<'pass' | 'fail' | null>(() =>
		assessment.valid ? (assessment.passes ? 'pass' : 'fail') : null
	);
	const against = $derived(assessment.valid ? assessment.against : '');

	// Verdict flips are announced after a 500 ms pause; ratio changes within a verdict are not.
	let announced: 'pass' | 'fail' | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const next = verdict;
		clearTimeout(timer);
		if (next === null || next === announced) return;
		timer = setTimeout(() => {
			announced = next;
			announce(
				next === 'pass'
					? `${roleTitle} color passes the contrast check.`
					: `${roleTitle} color is too low in contrast. Reports will use Tran's ${fallbackName}.`
			);
		}, ANNOUNCE_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});

	function onTextInput(event: Event) {
		const raw = (event.currentTarget as HTMLInputElement).value;
		text = raw;
		if (raw.trim() === '') {
			invalid = false;
			value = '';
			return;
		}
		const hex = normalizeHex(raw);
		invalid = hex === null;
		value = hex ?? '';
	}

	function onTextBlur() {
		const hex = normalizeHex(text);
		if (hex) text = hex;
	}

	function onPick(event: Event) {
		const hex = normalizeHex((event.currentTarget as HTMLInputElement).value);
		if (!hex) return;
		invalid = false;
		text = hex;
		value = hex;
	}

	function clear() {
		text = '';
		invalid = false;
		value = '';
	}

	function blockEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') event.preventDefault();
	}

	const describedBy = $derived(`${helpId} ${invalid ? errorId : verdictId}`);
</script>

<div class="grid gap-2">
	<Label for={hexId}>{copy.label}</Label>
	<p id={helpId} class="text-label text-muted-foreground">{copy.help}</p>
	<div class="flex flex-wrap items-center gap-3">
		<input
			type="color"
			aria-label={copy.pick}
			value={assessment.valid ? assessment.hex : BRAND_FALLBACK[role]}
			oninput={onPick}
			class="size-12 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		/>
		<Input
			id={hexId}
			type="text"
			value={text}
			oninput={onTextInput}
			onblur={onTextBlur}
			onkeydown={blockEnter}
			autocomplete="off"
			spellcheck={false}
			maxlength={7}
			placeholder="#A4452A"
			aria-invalid={invalid ? 'true' : undefined}
			aria-describedby={describedBy}
			class="w-32 uppercase tabular-nums"
		/>
		<Button variant="ghost" onclick={clear} disabled={text === '' && value === ''}>Clear</Button>
	</div>
	{#if invalid}
		<p id={errorId} class="flex items-center gap-1 text-label text-destructive">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{HEX_ERROR}
		</p>
	{:else}
		<div id={verdictId} data-testid="verdict-{role}" class="flex flex-wrap items-center gap-2">
			{#if !assessment.valid}
				<p class="text-label text-muted-foreground">
					No color chosen. Reports use Tran's {fallbackName}.
				</p>
			{:else if assessment.passes}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-secondary-surface px-2 py-0.5 text-label font-semibold text-secondary"
				>
					<CircleCheck class="size-4" aria-hidden="true" />Passes
				</span>
				<span class="text-label text-muted-foreground">
					{assessment.displayRatio}:1 with {against} text
				</span>
			{:else}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-label font-semibold text-foreground"
				>
					<TriangleAlert class="size-4" aria-hidden="true" />Too low
				</span>
				<span class="text-label text-muted-foreground">
					{assessment.displayRatio}:1 with {against} text. Reports will use Tran's {fallbackName} instead.
				</span>
				<span
					class="size-6 shrink-0 rounded-sm border border-border {copy.swatch}"
					aria-hidden="true"
				></span>
			{/if}
		</div>
	{/if}
</div>
