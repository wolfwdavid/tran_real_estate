<script lang="ts">
	// 06-UI-SPEC "LocationField" (RENT-01): the required location input every search starts with.
	// Phase 3 field anatomy. Validation runs on submit in the parent (core renter location
	// normalizer); this field only renders the resulting error. No autocomplete dropdown: Tran has
	// no geocoder host, and a lookup per keystroke would spend calls.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { LocationError } from '@tran/core/renter/types';

	interface Props {
		value?: string;
		error?: LocationError | null;
		id?: string;
		inputEl?: HTMLInputElement | undefined;
	}

	let {
		value = $bindable(''),
		error = null,
		id = 'location',
		inputEl = $bindable<HTMLInputElement | undefined>()
	}: Props = $props();

	const ERRORS: Record<LocationError, string> = {
		empty: 'Enter a city and state, or a ZIP code.',
		'city-without-state': 'Add the state, like Austin, TX.',
		'bad-zip': 'ZIP codes have 5 digits, like 78701.',
		unrecognized: 'Enter a city and state, like Austin, TX, or a 5-digit ZIP code.'
	};

	const helpId = $derived(`${id}-help`);
	const errorId = $derived(`${id}-error`);
	const errorText = $derived(error ? ERRORS[error] : null);
</script>

<div class="grid gap-2">
	<label for={id} class="text-base leading-[1.6] font-semibold text-foreground"
		>City and state, or ZIP code</label
	>
	<input
		{id}
		bind:this={inputEl}
		bind:value
		name="loc"
		type="text"
		autocomplete="off"
		inputmode="text"
		enterkeyhint="search"
		spellcheck="false"
		aria-invalid={errorText ? 'true' : undefined}
		aria-describedby={errorText ? `${helpId} ${errorId}` : helpId}
		class="h-12 w-full min-w-0 rounded-md border bg-card px-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring {errorText
			? 'border-destructive'
			: 'border-input'}"
	/>
	<p id={helpId} class="text-label text-muted-foreground">For example, Austin, TX or 78701.</p>
	{#if errorText}
		<p id={errorId} class="flex items-center gap-1 text-label text-destructive">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
			{errorText}
		</p>
	{/if}
</div>
