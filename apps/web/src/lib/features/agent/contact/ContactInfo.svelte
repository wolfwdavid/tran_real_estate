<script lang="ts">
	// Contact info (UI-SPEC "Contact detail > Contact info"): a <dl> of Email (mailto:), Phone
	// (a phone link, never a text-message link), Property of interest and Source, or, while `editing`, the in-place edit
	// form with the quick-add validation rules, a duplicate check against every other live contact
	// (same neutral alert as quick add, with Save anyway instead of Add as a separate contact) and
	// the email opt-out checkbox. Save writes through updateContact (logs "Details updated") and
	// setOptOut (logs the opt-out activity) and announces the result.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Users from '@lucide/svelte/icons/users';
	import { tick, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		CONTACT_SOURCES,
		SOURCE_LABELS,
		type Contact,
		type ContactSource
	} from '@tran/core/agent/types';
	import { MAX_EMAIL, MAX_NAME, MAX_PHONE, MAX_PROPERTY } from '@tran/core/agent/schemas';
	import { cleanText, firstName, normPhoneUS } from '@tran/core/leads/normalize';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import {
		Button,
		buttonVariants,
		Input,
		Label,
		announce
	} from '$lib/features/shared/data/platform-ui';
	import { findDuplicates, setOptOut, updateContact } from '$lib/storage/agent/contacts-repo';
	import { duplicateMessage, validateQuickAdd, type QuickAddField } from '../crm/quick-add';
	import NativeSelect from '../ui/NativeSelect.svelte';
	import UndoStatus from '../ui/UndoStatus.svelte';
	import { optOutAnnouncement } from './contact-ui';

	let {
		contact,
		editing = false,
		onclose
	}: {
		contact: Contact;
		/** Owned by the page (Edit details in the header switches it on). */
		editing?: boolean;
		/** After Cancel or a successful save (the page returns focus to Edit details). */
		onclose: () => void;
	} = $props();

	const uid = $props.id();
	const ids = {
		title: `${uid}-title`,
		name: `${uid}-name`,
		email: `${uid}-email`,
		phone: `${uid}-phone`,
		property: `${uid}-property`,
		source: `${uid}-source`,
		optOut: `${uid}-opt-out`,
		optOutLabel: `${uid}-opt-out-label`,
		dup: `${uid}-dup`
	};
	const errId = (f: QuickAddField) => `${uid}-${f}-error`;

	// Sample contacts keep their stored source selectable; everyone else chooses a real one.
	const sourceOptions = $derived(
		CONTACT_SOURCES.filter((s) => s !== 'sample' || contact.source === 'sample').map((s) => ({
			value: s,
			label: SOURCE_LABELS[s]
		}))
	);
	// Digits for the phone link (E.164 when the number normalizes, else the raw digits).
	const telDigits = $derived(normPhoneUS(contact.phone) ?? contact.phone.replace(/\D/g, ''));

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let property = $state('');
	let source = $state<string>('manual');
	let optOut = $state(false);
	let errors = $state<Partial<Record<QuickAddField, string>>>({});
	let pending = $state(false);
	let duplicate = $state<{ existing: Contact; reason: string } | null>(null);
	let status = $state<string | null>(null);

	let nameEl = $state<HTMLInputElement | null>(null);
	let emailEl = $state<HTMLInputElement | null>(null);
	let phoneEl = $state<HTMLInputElement | null>(null);
	let dupTitleEl = $state<HTMLElement | null>(null);

	// A fresh form each time edit mode opens, from the stored record (untracked so a live update
	// to the contact, like a stage move, never resets what the agent is typing).
	$effect(() => {
		if (!editing) return;
		untrack(() => {
			name = contact.name;
			email = contact.email;
			phone = contact.phone;
			property = contact.propertyOfInterest;
			source = contact.source;
			optOut = contact.emailOptOutAt !== null;
			errors = {};
			duplicate = null;
			status = null;
		});
		void tick().then(() => nameEl?.focus());
	});

	function edited(f: QuickAddField) {
		if (errors[f]) errors = { ...errors, [f]: undefined };
		duplicate = null;
	}

	async function save() {
		if (pending) return;
		pending = true;
		try {
			const patch = {
				name,
				email,
				phone,
				propertyOfInterest: property,
				source: source as ContactSource
			};
			const changed =
				cleanText(name) !== contact.name ||
				cleanText(email) !== contact.email ||
				cleanText(phone) !== contact.phone ||
				cleanText(property) !== contact.propertyOfInterest ||
				patch.source !== contact.source;
			const optChanged = optOut !== (contact.emailOptOutAt !== null);
			const now = new Date().toISOString();
			if (changed) await updateContact(contact.id, patch, now);
			if (optChanged) await setOptOut(contact.id, optOut, now);
			const savedName = cleanText(name) || contact.name;
			announce(optChanged ? optOutAnnouncement(savedName, optOut) : 'Details saved.');
			status = 'Details saved.';
			onclose();
		} finally {
			pending = false;
		}
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (pending) return;
		const v = validateQuickAdd({ name, email, phone });
		errors = v.errors;
		if (v.firstInvalid) {
			({ name: nameEl, email: emailEl, phone: phoneEl })[v.firstInvalid]?.focus();
			return;
		}
		pending = true;
		let dup: ReturnType<typeof duplicateMessage>;
		try {
			dup = duplicateMessage(await findDuplicates({ email, phone, excludeId: contact.id }));
		} finally {
			pending = false;
		}
		if (dup) {
			duplicate = dup;
			announce(`${dup.existing.name} is already in your contacts.`);
			await tick();
			dupTitleEl?.focus();
			return;
		}
		await save();
	}

	const openHref = (id: string) => resolve('/agent/contact/') + '?id=' + encodeURIComponent(id);
	const labelClass = 'text-base leading-[1.6] font-semibold';
	const dtClass = 'text-label font-semibold text-muted-foreground';
	const linkClass =
		'text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
</script>

<section aria-labelledby={ids.title} class="flex flex-col gap-4" data-contact-info>
	<h2 id={ids.title} class="text-base leading-[1.6] font-semibold text-foreground">Contact info</h2>

	{#if editing}
		<form class="grid gap-4" novalidate onsubmit={submit} data-contact-edit>
			<div class="grid gap-2">
				<Label for={ids.name} class={labelClass}>Name</Label>
				<Input
					id={ids.name}
					bind:ref={nameEl}
					bind:value={name}
					type="text"
					required
					maxlength={MAX_NAME}
					autocomplete="off"
					class="h-12"
					aria-invalid={errors.name ? 'true' : undefined}
					aria-describedby={errors.name ? errId('name') : undefined}
					oninput={() => edited('name')}
				/>
				{#if errors.name}
					<p id={errId('name')} class="flex items-center gap-1 text-label text-destructive">
						<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
						{errors.name}
					</p>
				{/if}
			</div>
			<div class="grid gap-2">
				<Label for={ids.email} class={labelClass}>Email</Label>
				<Input
					id={ids.email}
					bind:ref={emailEl}
					bind:value={email}
					type="email"
					maxlength={MAX_EMAIL}
					autocomplete="off"
					class="h-12"
					aria-invalid={errors.email ? 'true' : undefined}
					aria-describedby={errors.email ? errId('email') : undefined}
					oninput={() => edited('email')}
				/>
				{#if errors.email}
					<p id={errId('email')} class="flex items-center gap-1 text-label text-destructive">
						<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
						{errors.email}
					</p>
				{/if}
			</div>
			<div class="grid gap-2">
				<Label for={ids.phone} class={labelClass}>Phone</Label>
				<Input
					id={ids.phone}
					bind:ref={phoneEl}
					bind:value={phone}
					type="tel"
					maxlength={MAX_PHONE}
					autocomplete="off"
					class="h-12"
					aria-invalid={errors.phone ? 'true' : undefined}
					aria-describedby={errors.phone ? errId('phone') : undefined}
					oninput={() => edited('phone')}
				/>
				{#if errors.phone}
					<p id={errId('phone')} class="flex items-center gap-1 text-label text-destructive">
						<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
						{errors.phone}
					</p>
				{/if}
			</div>
			<div class="grid gap-2">
				<Label for={ids.property} class={labelClass}>Property of interest</Label>
				<Input
					id={ids.property}
					bind:value={property}
					type="text"
					maxlength={MAX_PROPERTY}
					autocomplete="off"
					class="h-12"
				/>
			</div>
			<NativeSelect id={ids.source} label="Source" bind:value={source} options={sourceOptions} />
			<div class="flex min-h-11 items-start gap-3">
				<div class="flex min-h-11 items-center">
					<Checkbox id={ids.optOut} bind:checked={optOut} aria-labelledby={ids.optOutLabel} />
				</div>
				<label
					id={ids.optOutLabel}
					for={ids.optOut}
					class="flex min-h-11 cursor-pointer items-center text-body text-foreground"
					>{contact.name} asked not to get emails from me</label
				>
			</div>

			{#if duplicate}
				<div
					data-duplicate-alert
					aria-labelledby={ids.dup}
					class="grid grid-cols-[20px_1fr] gap-x-3 gap-y-2 rounded-lg border border-border bg-surface p-4 text-foreground"
				>
					<Users size={20} class="mt-0.5 text-foreground" aria-hidden="true" />
					<div class="grid gap-2">
						<p
							id={ids.dup}
							bind:this={dupTitleEl}
							tabindex="-1"
							class="text-base leading-[1.6] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>
							{duplicate.existing.name} is already in your contacts
						</p>
						<p class="text-base leading-[1.6]">{duplicate.reason}</p>
						<div class="flex flex-wrap gap-2">
							<!-- eslint-disable svelte/no-navigation-without-resolve -- href is built from resolve() plus ?id= -->
							<a
								href={openHref(duplicate.existing.id)}
								class={buttonVariants({ variant: 'outline', class: 'min-h-11' })}
								>Open {firstName(duplicate.existing.name)}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							<Button variant="ghost" class="min-h-11" disabled={pending} onclick={save}
								>Save anyway</Button
							>
						</div>
					</div>
				</div>
			{/if}

			<div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
				<Button variant="outline" class="min-h-11" onclick={onclose}>Cancel</Button>
				<Button type="submit" class="min-h-11" disabled={pending}>
					{pending ? 'Saving…' : 'Save details'}
				</Button>
			</div>
		</form>
	{:else}
		<dl class="grid gap-4">
			<div class="grid gap-1">
				<dt class={dtClass}>Email</dt>
				<dd class="text-body wrap-anywhere text-foreground">
					{#if contact.email}
						<a href="mailto:{contact.email}" class={linkClass}>{contact.email}</a>
					{:else}
						<span class="text-muted-foreground">None</span>
					{/if}
				</dd>
			</div>
			<div class="grid gap-1">
				<dt class={dtClass}>Phone</dt>
				<dd class="text-body text-foreground tabular-nums">
					{#if contact.phone}
						<a href="tel:{telDigits}" class={linkClass}>{contact.phone}</a>
					{:else}
						<span class="text-muted-foreground">None</span>
					{/if}
				</dd>
			</div>
			<div class="grid gap-1">
				<dt class={dtClass}>Property of interest</dt>
				<dd class="text-body wrap-anywhere text-foreground">
					{#if contact.propertyOfInterest}
						{contact.propertyOfInterest}
					{:else}
						<span class="text-muted-foreground">None</span>
					{/if}
				</dd>
			</div>
			<div class="grid gap-1">
				<dt class={dtClass}>Source</dt>
				<dd class="text-body text-foreground">{SOURCE_LABELS[contact.source]}</dd>
			</div>
		</dl>
		<UndoStatus message={status} />
	{/if}
</section>
