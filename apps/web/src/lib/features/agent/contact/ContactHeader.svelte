<script lang="ts">
	// Contact detail header (UI-SPEC "Contact detail > Header"): the name as the page h1, the meta
	// row (stage, Sample data, No emails, added date and source), then the actions. The Stage
	// select goes through the pipeline's board-state move() so a change from here writes the same
	// activity, sets the same UndoStatus line and announces the same way as a board move (AGT-04).
	// Delete contact confirms through the Phase 3 ConfirmDialog (never the browser's confirm box), cascades
	// through the repo, then leaves a one-shot flash for the Contacts page and redirects there.
	import MailX from '@lucide/svelte/icons/mail-x';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import UserPen from '@lucide/svelte/icons/user-pen';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { STAGES, STAGE_LABELS, type Contact, type Stage } from '@tran/core/agent/types';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import { Button, ConfirmDialog, announce } from '$lib/features/shared/data/platform-ui';
	import { deleteContact } from '$lib/storage/agent/contacts-repo';
	import { setFlash } from '../crm/flash.svelte';
	import { BOARD_UNDO_ID, type BoardState } from '../pipeline/board-state.svelte';
	import NativeSelect from '../ui/NativeSelect.svelte';
	import StageBadge from '../ui/StageBadge.svelte';
	import UndoStatus from '../ui/UndoStatus.svelte';
	import { addedMeta, deleteDialogCopy } from './contact-ui';

	let {
		contact,
		taskCount,
		board,
		onedit,
		onleaving
	}: {
		contact: Contact;
		/** Live tasks of this contact (open and done), for the delete confirmation copy. */
		taskCount: number;
		/** The page's board state: one move / undo path shared with the pipeline. */
		board: BoardState;
		/** Edit details: the page switches ContactInfo into its edit form. */
		onedit: () => void;
		/** Called before the delete runs so the page keeps this contact on screen until the redirect. */
		onleaving: (contact: Contact) => void;
	} = $props();

	const uid = $props.id();
	const stageId = `${uid}-stage`;
	const stageOptions = STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }));
	const copy = $derived(deleteDialogCopy(contact.name, taskCount));
	let deleted = false;

	function onStageChange(value: string) {
		void board.move(contact, value as Stage, { focus: false });
	}

	async function confirmDelete() {
		const { id, name } = contact;
		onleaving(contact);
		await deleteContact(id);
		deleted = true;
		announce(`Deleted ${name}.`);
		setFlash(`Deleted ${name}.`);
		// Not awaited: the dialog closes at once and the Contacts page focuses its status line.
		void goto(resolve('/agent/contacts/'));
	}
</script>

<header class="flex flex-col gap-6" data-contact-header>
	<div class="flex flex-col gap-2">
		<h1 class="font-display text-display font-semibold text-balance wrap-anywhere text-foreground">
			{contact.name}
		</h1>
		<div class="flex flex-wrap items-center gap-2">
			<StageBadge stage={contact.stage} />
			{#if contact.sample}<SampleChip />{/if}
			{#if contact.emailOptOutAt}
				<span
					data-no-emails
					class="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-label font-semibold whitespace-nowrap text-muted-foreground"
				>
					<MailX class="size-3.5" aria-hidden="true" />
					No emails
				</span>
			{/if}
			<span class="text-label text-muted-foreground" data-added-meta>{addedMeta(contact)}</span>
		</div>
	</div>

	<div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
		<div class="w-full sm:w-56">
			<NativeSelect
				id={stageId}
				label="Stage"
				value={contact.stage}
				options={stageOptions}
				onchange={onStageChange}
			/>
		</div>
		<Button variant="outline" class="min-h-11" data-edit-details onclick={onedit}>
			<UserPen size={16} aria-hidden="true" />
			Edit details
		</Button>
		<ConfirmDialog
			title={copy.title}
			body={[copy.body]}
			confirmLabel={copy.confirmLabel}
			confirmBusyLabel="Deleting…"
			cancelLabel={copy.cancelLabel}
			onConfirm={confirmDelete}
			onCloseAutoFocus={(e) => {
				// After a delete the trigger is gone; the Contacts page moves focus to its status line.
				if (deleted) e.preventDefault();
			}}
		>
			{#snippet trigger({ props })}
				<Button variant="destructive-outline" class="min-h-11" {...props}>
					<Trash2 size={16} aria-hidden="true" />
					Delete contact
				</Button>
			{/snippet}
		</ConfirmDialog>
	</div>

	<UndoStatus
		id={BOARD_UNDO_ID}
		message={board.status}
		onundo={board.undo ? board.undoLast : undefined}
	/>
</header>
