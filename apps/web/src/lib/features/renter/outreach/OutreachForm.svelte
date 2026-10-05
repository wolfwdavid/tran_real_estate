<script lang="ts">
	// 06-UI-SPEC "OutreachForm" (RENT-07). A plain <form> with no submit button: the panel's
	// **Draft message** is the action, and it calls validate() first through the panel's
	// beforeGenerate hook. Fair Housing by construction: the only household detail is a number.
	// Values live in the parent's $state object (bound), so the panel's inputs follow every edit.
	import { tick } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { RenterOutreachForm } from '$lib/ai/prompts/renter/outreach.v1';
	import { EXTRA_QUESTION_MAX, validateOutreachForm, type OutreachErrors } from './outreach-form';

	interface Props {
		form: RenterOutreachForm;
		idPrefix?: string;
	}

	let { form = $bindable(), idPrefix = 'outreach' }: Props = $props();

	const TOPICS: ReadonlyArray<{ key: keyof RenterOutreachForm['topics']; label: string }> = [
		{ key: 'availability', label: 'Availability and move-in timing' },
		{ key: 'pets', label: 'Pet policy and pet fees' },
		{ key: 'fees', label: 'Application fees and deposit' },
		{ key: 'lease', label: 'Lease length and terms' }
	];
	const PETS: ReadonlyArray<{ value: RenterOutreachForm['pets']; label: string }> = [
		{ value: 'none', label: 'No pets' },
		{ value: 'yes', label: 'Yes' }
	];

	// Errors appear after the first Draft message press, then follow every edit.
	let attempted = $state(false);
	const result = $derived(attempted ? validateOutreachForm(form) : null);
	const errors = $derived<OutreachErrors>(result && !result.ok ? result.errors : {});

	const ids = $derived({
		moveIn: `${idPrefix}-move-in`,
		moveInHelp: `${idPrefix}-move-in-help`,
		people: `${idPrefix}-people`,
		peopleHelp: `${idPrefix}-people-help`,
		peopleError: `${idPrefix}-people-error`,
		petsLegend: `${idPrefix}-pets-legend`,
		petKind: `${idPrefix}-pet-kind`,
		petKindHelp: `${idPrefix}-pet-kind-help`,
		topicsError: `${idPrefix}-topics-error`,
		firstTopic: `${idPrefix}-topic-availability`,
		question: `${idPrefix}-question`,
		questionCount: `${idPrefix}-question-count`
	});

	/**
	 * Runs the UI-SPEC validation. On failure it shows the field errors and moves focus to the
	 * first invalid field (Phase 3), and returns false so nothing is generated.
	 */
	export function validate(): boolean {
		attempted = true;
		const result = validateOutreachForm(form);
		if (result.ok) return true;
		const target = result.first === 'occupants' ? ids.people : ids.firstTopic;
		void tick().then(() => document.getElementById(target)?.focus());
		return false;
	}

	const describedBy = (...list: Array<string | null | false | undefined>) =>
		list.filter(Boolean).join(' ') || undefined;

	const label = 'text-base leading-[1.6] font-semibold text-foreground';
	const helper = 'text-label text-muted-foreground';
	const inputClass = (invalid: boolean) =>
		`h-12 w-full min-w-0 rounded-md border bg-card px-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
			invalid ? 'border-destructive' : 'border-input'
		}`;
	const chip =
		'relative inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-1 rounded-full border border-input bg-card px-4 text-base leading-[1.6] font-normal text-foreground has-checked:border-foreground has-checked:bg-foreground has-checked:font-semibold has-checked:text-card has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring';
	const HIDDEN_INPUT = 'absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0';
</script>

{#snippet fieldError(id: string, message: string)}
	<p {id} class="flex items-center gap-1 text-label text-destructive">
		<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
		{message}
	</p>
{/snippet}

<form
	class="grid gap-6"
	aria-label="What to ask the listing contact"
	novalidate
	onsubmit={(e) => e.preventDefault()}
	data-outreach-form
>
	<div class="grid gap-2">
		<label for={ids.moveIn} class={label}>Move-in date</label>
		<input
			id={ids.moveIn}
			type="date"
			bind:value={form.moveInDate}
			autocomplete="off"
			aria-describedby={ids.moveInHelp}
			class="{inputClass(false)} sm:w-56"
		/>
		<p id={ids.moveInHelp} class={helper}>Leave blank if you're flexible.</p>
	</div>

	<div class="grid gap-2">
		<label for={ids.people} class={label}>How many people will live there</label>
		<input
			id={ids.people}
			type="text"
			inputmode="numeric"
			pattern="[0-9]*"
			autocomplete="off"
			bind:value={form.occupants}
			aria-invalid={errors.occupants ? 'true' : undefined}
			aria-describedby={describedBy(ids.peopleHelp, errors.occupants && ids.peopleError)}
			class="{inputClass(!!errors.occupants)} tabular-nums sm:w-32"
		/>
		<p id={ids.peopleHelp} class={helper}>Only the number is used. Don't add names or ages.</p>
		{#if errors.occupants}{@render fieldError(ids.peopleError, errors.occupants)}{/if}
	</div>

	<fieldset class="grid min-w-0 gap-2">
		<legend id={ids.petsLegend} class={label}>Pets</legend>
		<div class="mt-2 flex flex-wrap gap-2">
			{#each PETS as option (option.value)}
				<label class={chip}>
					<input
						type="radio"
						name="{idPrefix}-pets"
						class={HIDDEN_INPUT}
						value={option.value}
						bind:group={form.pets}
					/>
					{#if form.pets === option.value}<Check class="size-4" aria-hidden="true" />{/if}
					{option.label}
				</label>
			{/each}
		</div>
		{#if form.pets === 'yes'}
			<div class="mt-2 grid gap-2">
				<label for={ids.petKind} class={label}>What pets?</label>
				<input
					id={ids.petKind}
					type="text"
					maxlength="60"
					autocomplete="off"
					bind:value={form.petDescription}
					aria-describedby={ids.petKindHelp}
					class="{inputClass(false)} sm:max-w-sm"
				/>
				<p id={ids.petKindHelp} class={helper}>For example: one cat, or a 30 lb dog.</p>
			</div>
		{/if}
	</fieldset>

	<fieldset
		class="grid min-w-0 gap-1"
		aria-describedby={errors.topics ? ids.topicsError : undefined}
	>
		<legend class={label}>What to ask about</legend>
		<div class="mt-2 grid gap-1">
			{#each TOPICS as topic (topic.key)}
				<label
					class="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 text-base leading-[1.6] text-foreground"
				>
					<input
						id="{idPrefix}-topic-{topic.key}"
						type="checkbox"
						bind:checked={form.topics[topic.key]}
						aria-invalid={errors.topics ? 'true' : undefined}
						class="size-5 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					/>
					{topic.label}
				</label>
			{/each}
		</div>
		{#if errors.topics}{@render fieldError(ids.topicsError, errors.topics)}{/if}
	</fieldset>

	<div class="grid gap-2">
		<label for={ids.question} class={label}>Anything else to ask</label>
		<textarea
			id={ids.question}
			maxlength="500"
			bind:value={form.extraQuestion}
			aria-describedby={ids.questionCount}
			class="min-h-24 w-full min-w-0 rounded-md border border-input bg-card px-4 py-3 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		></textarea>
		<p id={ids.questionCount} class="{helper} tabular-nums" aria-live="off">
			{form.extraQuestion.length} of {EXTRA_QUESTION_MAX}
		</p>
	</div>
</form>
