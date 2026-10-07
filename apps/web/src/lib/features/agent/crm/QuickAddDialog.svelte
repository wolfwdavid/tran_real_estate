<script lang="ts">
	// UI-SPEC "QuickAddDialog" (AGT-03): add one lead by hand. Caller-owned open state; Name takes
	// initial focus. Submit validates (focus moves to the first invalid field), then looks for a
	// live contact with the same normalized email or phone. A match shows a neutral in-dialog notice
	// and nothing is saved until the agent opens the existing contact or adds this one anyway.
	// Writes only to this browser's IndexedDB; no network.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Users from '@lucide/svelte/icons/users';
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { STAGES, STAGE_LABELS, type Contact, type Stage } from '@tran/core/agent/types';
	import { MAX_CONTACT_NOTES } from '@tran/core/agent/schemas';
	import { firstName } from '@tran/core/leads/normalize';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		Button,
		buttonVariants,
		Input,
		Label,
		announce
	} from '$lib/features/shared/data/platform-ui';
	import { addContact, findDuplicates } from '$lib/storage/agent/contacts-repo';
	import NativeSelect from '../ui/NativeSelect.svelte';
	import { duplicateMessage, validateQuickAdd, type QuickAddField } from './quick-add';

	let {
		open = $bindable(false),
		defaultStage = 'new',
		onadded
	}: {
		open?: boolean;
		defaultStage?: Stage;
		/** Called after the dialog has closed on a successful add (the caller moves focus). */
		onadded?: (c: Contact) => void;
	} = $props();

	const uid = $props.id();
	const ids = {
		name: `${uid}-name`,
		email: `${uid}-email`,
		phone: `${uid}-phone`,
		stage: `${uid}-stage`,
		property: `${uid}-property`,
		notes: `${uid}-notes`,
		help: `${uid}-help`,
		dup: `${uid}-dup`
	};
	const stageOptions = STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }));

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let stage = $state<string>('new');
	let property = $state('');
	let notes = $state('');
	let errors = $state<Partial<Record<QuickAddField, string>>>({});
	let pending = $state(false);
	let duplicate = $state<{ existing: Contact; reason: string } | null>(null);
	let added: Contact | null = null;

	let nameEl = $state<HTMLInputElement | null>(null);
	let emailEl = $state<HTMLInputElement | null>(null);
	let phoneEl = $state<HTMLInputElement | null>(null);
	let dupTitleEl = $state<HTMLElement | null>(null);

	// Reset every field each time the dialog opens.
	$effect(() => {
		if (!open) return;
		name = '';
		email = '';
		phone = '';
		stage = defaultStage;
		property = '';
		notes = '';
		errors = {};
		pending = false;
		duplicate = null;
		added = null;
	});

	const errId = (f: QuickAddField) => `${uid}-${f}-error`;
	const describedBy = (f: 'email' | 'phone') => (errors[f] ? `${errId(f)} ${ids.help}` : ids.help);

	function edited(f: QuickAddField) {
		if (errors[f]) errors = { ...errors, [f]: undefined };
		duplicate = null;
	}

	async function save() {
		pending = true;
		try {
			const c = await addContact({
				name,
				email,
				phone,
				stage: stage as Stage,
				propertyOfInterest: property,
				notes,
				source: 'manual',
				consentSource: 'unknown'
			});
			added = c;
			announce(`Added ${c.name} to ${STAGE_LABELS[c.stage]}.`);
			open = false;
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
			dup = duplicateMessage(await findDuplicates({ email, phone }));
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
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		showCloseButton={false}
		class="max-h-[calc(100dvh-2rem)] overflow-y-auto"
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			nameEl?.focus();
		}}
		onCloseAutoFocus={(e) => {
			if (!added) return;
			// Success: the caller decides where focus goes (the new contact or the page h1).
			e.preventDefault();
			const c = added;
			added = null;
			onadded?.(c);
		}}
	>
		<Dialog.Title>Add a lead</Dialog.Title>
		<form class="grid gap-4" novalidate onsubmit={submit}>
			<div class="grid gap-2">
				<Label for={ids.name} class="text-base leading-[1.6] font-semibold">Name</Label>
				<Input
					id={ids.name}
					bind:ref={nameEl}
					bind:value={name}
					type="text"
					required
					maxlength={120}
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
				<Label for={ids.email} class="text-base leading-[1.6] font-semibold">Email</Label>
				<Input
					id={ids.email}
					bind:ref={emailEl}
					bind:value={email}
					type="email"
					maxlength={254}
					autocomplete="off"
					class="h-12"
					aria-invalid={errors.email ? 'true' : undefined}
					aria-describedby={describedBy('email')}
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
				<Label for={ids.phone} class="text-base leading-[1.6] font-semibold">Phone</Label>
				<Input
					id={ids.phone}
					bind:ref={phoneEl}
					bind:value={phone}
					type="tel"
					maxlength={40}
					autocomplete="off"
					class="h-12"
					aria-invalid={errors.phone ? 'true' : undefined}
					aria-describedby={describedBy('phone')}
					oninput={() => edited('phone')}
				/>
				{#if errors.phone}
					<p id={errId('phone')} class="flex items-center gap-1 text-label text-destructive">
						<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
						{errors.phone}
					</p>
				{/if}
				<p id={ids.help} class="text-label text-muted-foreground">
					Add an email, a phone number, or both.
				</p>
			</div>
			<NativeSelect id={ids.stage} label="Stage" bind:value={stage} options={stageOptions} />
			<div class="grid gap-2">
				<Label for={ids.property} class="text-base leading-[1.6] font-semibold"
					>Property of interest</Label
				>
				<Input
					id={ids.property}
					bind:value={property}
					type="text"
					maxlength={300}
					autocomplete="off"
					class="h-12"
				/>
			</div>
			<div class="grid gap-2">
				<Label for={ids.notes} class="text-base leading-[1.6] font-semibold">Notes</Label>
				<Textarea
					id={ids.notes}
					bind:value={notes}
					maxlength={MAX_CONTACT_NOTES}
					class="min-h-32"
				/>
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
								onclick={() => (open = false)}>Open {firstName(duplicate.existing.name)}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
							<Button variant="ghost" class="min-h-11" disabled={pending} onclick={save}
								>Add as a separate contact</Button
							>
						</div>
					</div>
				</div>
			{/if}

			<Dialog.Footer>
				<Button variant="outline" class="min-h-11" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" class="min-h-11" disabled={pending}>
					{pending ? 'Adding…' : 'Add lead'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
