<script lang="ts">
	// The profile form (AGT-01, UI-SPEC "Profile" groups 1-2): "Your details" and "Mailing address"
	// fieldsets, the sticky Save profile row and the status line. Plan 08-22 adds the Logo and Brand
	// colors fieldsets through `extraFieldsets`, inside this same <form>. Every change is reported
	// through `onchange` so the page can feed the live previews. Validation is the pure
	// profile-form.ts; the save goes through profile-repo.saveProfile (IndexedDB).
	import { tick, untrack, type Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import {
		LICENSE_TYPES,
		LICENSE_TYPE_LABELS,
		US_STATES,
		type LicenseType,
		type ProfileInput
	} from '@tran/core/agent/types';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import NativeSelect from '$lib/features/agent/ui/NativeSelect.svelte';
	import SectionError from '$lib/features/shared/settings/SectionError.svelte';
	import { saveProfile } from '$lib/storage/agent/profile-repo';
	import {
		isDirty,
		normalizeWebsite,
		toProfileInput,
		validateProfile,
		type FieldId
	} from './profile-form';

	interface Props {
		/** The saved profile (EMPTY_PROFILE_INPUT until it has loaded). */
		initial: ProfileInput;
		/** Called with a plain copy of the draft after every change (feeds the live previews). */
		onchange?: (draft: ProfileInput) => void;
		/**
		 * Extra <fieldset> panels rendered inside the form, before the save row (plan 08-22). The
		 * snippet receives the live draft so its fields write straight into it.
		 */
		extraFieldsets?: Snippet<[ProfileInput]>;
	}

	let { initial, onchange, extraFieldsets }: Props = $props();

	// svelte-ignore state_referenced_locally
	let saved = $state.raw<ProfileInput>(toProfileInput(initial));
	// svelte-ignore state_referenced_locally
	let draft = $state<ProfileInput>(toProfileInput(initial));

	// The saved profile arrives after mount (and again after each save). Adopt it as the baseline;
	// replace the draft too unless the agent has already typed something.
	$effect(() => {
		const next = toProfileInput(initial);
		untrack(() => {
			const typed = isDirty(saved, $state.snapshot(draft));
			saved = next;
			if (!typed) draft = toProfileInput(next);
		});
	});

	$effect(() => {
		onchange?.($state.snapshot(draft));
	});

	const dirty = $derived(isDirty(saved, draft));

	let errors = $state<Partial<Record<FieldId, string>>>({});
	let saving = $state(false);
	let savedOnce = $state(false);
	let failure = $state<{ title: string; body: string } | null>(null);
	// Bumped per failure so a repeated failure re-mounts (and re-announces) the SectionError.
	let failureSeq = $state(0);
	let formEl = $state<HTMLFormElement | null>(null);
	let saveEl = $state<HTMLButtonElement | null>(null);

	const statusText = $derived(dirty ? 'You have unsaved changes.' : savedOnce ? 'Saved.' : '');

	const LICENSE_TYPE_OPTIONS = [
		{ value: '', label: 'Choose a license type' },
		...LICENSE_TYPES.map((t) => ({ value: t, label: LICENSE_TYPE_LABELS[t] }))
	];
	const STATE_OPTIONS = [
		{ value: '', label: 'Choose a state' },
		...US_STATES.map((s) => ({ value: s.code, label: s.name }))
	];

	const fieldId = (f: FieldId) => `profile-${f}`;
	const errId = (f: FieldId) => `profile-${f}-error`;
	const describedBy = (f: FieldId, extra?: string) =>
		[errors[f] ? errId(f) : '', extra ?? ''].filter(Boolean).join(' ') || undefined;

	/** Enter inside a text field must not submit; only the Save profile button does. */
	function blockEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') event.preventDefault();
	}

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		failure = null;

		const v = validateProfile($state.snapshot(draft));
		errors = v.errors;
		if (v.firstInvalid !== null) {
			formEl?.querySelector<HTMLElement>(`#${fieldId(v.firstInvalid)}`)?.focus();
			return;
		}

		draft.website = normalizeWebsite(draft.website);
		draft.iabsUrl = normalizeWebsite(draft.iabsUrl);
		saving = true;
		try {
			const stored = await saveProfile($state.snapshot(draft));
			const next = toProfileInput(stored);
			saved = next;
			draft = toProfileInput(next);
			savedOnce = true;
			announce('Profile saved.');
		} catch {
			failure = {
				title: "Your profile wasn't saved",
				body: 'Your changes are still on this page. Try again. If it keeps failing, check Storage in Settings.'
			};
			failureSeq += 1;
		} finally {
			saving = false;
		}
		// The button was disabled while saving; let it re-enable before focus returns to it.
		await tick();
		saveEl?.focus();
	}
</script>

{#snippet fieldError(f: FieldId)}
	{#if errors[f]}
		<p id={errId(f)} class="flex items-center gap-1 text-label text-destructive">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{errors[f]}
		</p>
	{/if}
{/snippet}

{#snippet textField(
	f: FieldId,
	label: string,
	value: string,
	set: (v: string) => void,
	attrs: {
		type?: 'text' | 'email' | 'tel' | 'url';
		autocomplete?: HTMLInputAttributes['autocomplete'];
		maxlength?: number;
		help?: string;
	} = {}
)}
	<div class="grid gap-2">
		<Label for={fieldId(f)}>{label}</Label>
		{#if attrs.help}
			<p id="{fieldId(f)}-help" class="text-label text-muted-foreground">{attrs.help}</p>
		{/if}
		<Input
			id={fieldId(f)}
			type={attrs.type ?? 'text'}
			{value}
			oninput={(e) => set(e.currentTarget.value)}
			onkeydown={blockEnter}
			autocomplete={attrs.autocomplete}
			maxlength={attrs.maxlength ?? 120}
			aria-invalid={errors[f] ? 'true' : undefined}
			aria-describedby={describedBy(f, attrs.help ? `${fieldId(f)}-help` : undefined)}
		/>
		{@render fieldError(f)}
	</div>
{/snippet}

<form
	bind:this={formEl}
	novalidate
	{onsubmit}
	aria-busy={saving}
	aria-label="Your profile"
	class="flex min-w-0 flex-col gap-8"
>
	<fieldset class="min-w-0 rounded-lg border border-border bg-card p-6 shadow-card">
		<legend class="float-left mb-6 w-full">
			<h2 class="font-display text-heading font-semibold">Your details</h2>
		</legend>
		<div class="clear-both grid gap-6">
			{@render textField('name', 'Full name', draft.name, (v) => (draft.name = v), {
				autocomplete: 'name'
			})}
			{@render textField('brokerage', 'Brokerage', draft.brokerage, (v) => (draft.brokerage = v), {
				autocomplete: 'organization'
			})}
			{@render textField(
				'teamName',
				'Team name (optional)',
				draft.teamName,
				(v) => (draft.teamName = v)
			)}
			<div class="grid gap-2">
				<NativeSelect
					id={fieldId('licenseType')}
					label="License type"
					value={draft.licenseType}
					options={LICENSE_TYPE_OPTIONS}
					invalid={errors.licenseType !== undefined}
					describedby={describedBy('licenseType')}
					onchange={(v) => (draft.licenseType = v as LicenseType | '')}
				/>
				{@render fieldError('licenseType')}
			</div>
			{@render textField(
				'licenseNumber',
				'License number',
				draft.licenseNumber,
				(v) => (draft.licenseNumber = v),
				{ autocomplete: 'off', maxlength: 40 }
			)}
			<div class="grid gap-2">
				<NativeSelect
					id={fieldId('licenseState')}
					label="License state"
					bind:value={draft.licenseState}
					options={STATE_OPTIONS}
					invalid={errors.licenseState !== undefined}
					describedby={describedBy('licenseState')}
				/>
				{@render fieldError('licenseState')}
			</div>
			{@render textField(
				'brokerageLicenseNumber',
				'Brokerage license number (optional)',
				draft.brokerageLicenseNumber,
				(v) => (draft.brokerageLicenseNumber = v),
				{ autocomplete: 'off', maxlength: 40 }
			)}
			{@render textField(
				'brokeragePhone',
				'Brokerage phone',
				draft.brokeragePhone,
				(v) => (draft.brokeragePhone = v),
				{
					type: 'tel',
					autocomplete: 'off',
					maxlength: 30,
					help: "New York and New Jersey require your brokerage's phone in ads. It's also the only number shown on your inquiry page."
				}
			)}
			{@render textField('phone', 'Phone', draft.phone, (v) => (draft.phone = v), {
				type: 'tel',
				autocomplete: 'tel',
				maxlength: 30
			})}
			{@render textField('email', 'Email', draft.email, (v) => (draft.email = v), {
				type: 'email',
				autocomplete: 'email',
				maxlength: 254
			})}
			{@render textField(
				'website',
				'Website (optional)',
				draft.website,
				(v) => (draft.website = v),
				{
					type: 'url',
					autocomplete: 'url',
					maxlength: 2048
				}
			)}
			{@render textField(
				'iabsUrl',
				'Texas IABS link (optional)',
				draft.iabsUrl,
				(v) => (draft.iabsUrl = v),
				{
					type: 'url',
					autocomplete: 'off',
					maxlength: 2048,
					help: 'Texas agents: link to your IABS form from TREC. It goes under your disclosure.'
				}
			)}
		</div>
	</fieldset>

	<fieldset class="min-w-0 rounded-lg border border-border bg-card p-6 shadow-card">
		<legend class="float-left mb-2 w-full">
			<h2 class="font-display text-heading font-semibold">Mailing address</h2>
		</legend>
		<p class="clear-both mb-6 text-label text-muted-foreground">
			U.S. law (CAN-SPAM) requires a valid mailing address in commercial email. A street address, a
			P.O. box, or a registered private mailbox all work.
		</p>
		<div class="grid gap-6">
			{@render textField(
				'street',
				'Street address',
				draft.postal.street,
				(v) => (draft.postal.street = v),
				{ autocomplete: 'address-line1' }
			)}
			{@render textField(
				'line2',
				'Address line 2 (optional)',
				draft.postal.line2,
				(v) => (draft.postal.line2 = v),
				{ autocomplete: 'address-line2' }
			)}
			<div class="grid gap-6 sm:grid-cols-3">
				{@render textField('city', 'City', draft.postal.city, (v) => (draft.postal.city = v), {
					autocomplete: 'address-level2'
				})}
				<div class="grid gap-2">
					<NativeSelect
						id={fieldId('postalState')}
						label="State"
						bind:value={draft.postal.state}
						options={STATE_OPTIONS}
						invalid={errors.postalState !== undefined}
						describedby={describedBy('postalState')}
					/>
					{@render fieldError('postalState')}
				</div>
				{@render textField('zip', 'ZIP code', draft.postal.zip, (v) => (draft.postal.zip = v), {
					autocomplete: 'postal-code',
					maxlength: 10
				})}
			</div>
		</div>
	</fieldset>

	{@render extraFieldsets?.(draft)}

	{#if failure}
		{#key failureSeq}
			<SectionError title={failure.title} body={failure.body} />
		{/key}
	{/if}

	<div class="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center gap-4 bg-background px-2 py-4">
		<Button type="submit" bind:ref={saveEl} disabled={saving} class="gap-2">
			{#if saving}
				<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
			{/if}
			{saving ? 'Saving…' : 'Save profile'}
		</Button>
		<p data-testid="profile-status" class="text-label text-muted-foreground">{statusText}</p>
	</div>
</form>
