<script lang="ts">
	// 06-UI-SPEC ShortlistCard "Notes" (RENT-05). Saving is explicit (Save notes / Cancel), so a
	// stray blur never loses or half-saves an edit; Escape cancels. Focus returns to the Add/Edit
	// button, which is the same element whatever its label, so it survives the liveQuery update.
	import { tick } from 'svelte';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import { MAX_NOTES, notesPreview } from '@tran/core/renter/records';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button, announce } from '$lib/features/shared/data/platform-ui';
	import { getShortlistRepo } from '../storage/shortlist-repo';

	interface Props {
		listingId: string;
		notes: string;
		streetLine: string;
	}

	let { listingId, notes, streetLine }: Props = $props();

	let editing = $state(false);
	let draft = $state('');
	let busy = $state(false);
	let toggleEl = $state<HTMLElement | null>(null);
	let fieldEl = $state<HTMLTextAreaElement | null>(null);

	const fieldId = $derived('notes-' + encodeURIComponent(listingId));
	const counterId = $derived(fieldId + '-count');
	const hasNotes = $derived(notes.trim() !== '');
	const MAX_TEXT = MAX_NOTES.toLocaleString('en-US');

	async function open(): Promise<void> {
		draft = notes;
		editing = true;
		await tick();
		fieldEl?.focus();
	}

	async function close(): Promise<void> {
		editing = false;
		await tick();
		toggleEl?.focus();
	}

	async function save(): Promise<void> {
		if (busy) return;
		busy = true;
		try {
			await getShortlistRepo().setNotes(listingId, draft.slice(0, MAX_NOTES));
			announce('Notes saved.');
			await close();
		} finally {
			busy = false;
		}
	}

	function onkeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			e.preventDefault();
			void close();
		}
	}
</script>

{#if editing}
	<div class="grid gap-2">
		<label for={fieldId} class="sr-only">Notes for {streetLine}</label>
		<Textarea
			bind:ref={fieldEl}
			bind:value={draft}
			id={fieldId}
			class="min-h-24"
			maxlength={MAX_NOTES}
			aria-describedby={counterId}
			{onkeydown}
		/>
		<p id={counterId} aria-live="off" class="text-label text-muted-foreground tabular-nums">
			{draft.length.toLocaleString('en-US')} of {MAX_TEXT}
		</p>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" disabled={busy} onclick={save}>Save notes</Button>
			<Button variant="ghost" onclick={close}>Cancel</Button>
		</div>
	</div>
{:else}
	<div class="grid justify-items-start gap-2">
		{#if hasNotes}
			<p
				class="text-base leading-[1.6] [overflow-wrap:anywhere] whitespace-pre-line text-foreground"
			>
				{notesPreview(notes)}
			</p>
		{/if}
		<Button bind:ref={toggleEl} variant="ghost" onclick={open}>
			<StickyNote size={16} aria-hidden="true" />
			{hasNotes ? 'Edit notes' : 'Add notes'}
		</Button>
	</div>
{/if}
