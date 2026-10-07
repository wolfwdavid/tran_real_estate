<script lang="ts">
	// Notes on the contact detail page (UI-SPEC "Contact detail > Notes"): one textarea saved on
	// blur and with Save notes through updateContact with logActivity false (notes are private
	// context for the follow-up draft, not activity). Nothing is written when the text is unchanged.
	import type { Contact } from '@tran/core/agent/types';
	import { MAX_CONTACT_NOTES } from '@tran/core/agent/schemas';
	import { cleanText, firstName } from '@tran/core/leads/normalize';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button, Label, announce } from '$lib/features/shared/data/platform-ui';
	import { updateContact } from '$lib/storage/agent/contacts-repo';
	import UndoStatus from '../ui/UndoStatus.svelte';

	let { contact }: { contact: Contact } = $props();

	const uid = $props.id();
	const ids = { notes: `${uid}-notes`, help: `${uid}-help` };

	// The textarea owns the text after mount; the stored record is the comparison baseline.
	// svelte-ignore state_referenced_locally
	let notes = $state(contact.notes);
	let status = $state<string | null>(null);
	let pending = false;

	async function save() {
		if (pending || cleanText(notes) === contact.notes) return;
		pending = true;
		try {
			await updateContact(contact.id, { notes }, new Date().toISOString(), {
				logActivity: false
			});
			status = 'Notes saved.';
			announce('Notes saved.');
		} finally {
			pending = false;
		}
	}
</script>

<section aria-labelledby="notes-title" class="flex flex-col gap-4" data-contact-notes>
	<h2 id="notes-title" class="font-display text-heading font-semibold text-foreground">Notes</h2>
	<div class="grid gap-2">
		<Label for={ids.notes} class="text-base leading-[1.6] font-semibold"
			>Notes about {firstName(contact.name)}</Label
		>
		<Textarea
			id={ids.notes}
			bind:value={notes}
			maxlength={MAX_CONTACT_NOTES}
			aria-describedby={ids.help}
			class="min-h-40"
			onblur={save}
			oninput={() => (status = null)}
		/>
		<p id={ids.help} class="text-label text-muted-foreground">
			Private to this browser. Notes help the AI write a better follow-up, and names, emails, and
			phone numbers are replaced before anything is sent.
		</p>
	</div>
	<div class="flex flex-wrap items-center gap-4">
		<Button variant="outline" class="min-h-11" onclick={save}>Save notes</Button>
		<UndoStatus id="notes-status" message={status} />
	</div>
</section>
