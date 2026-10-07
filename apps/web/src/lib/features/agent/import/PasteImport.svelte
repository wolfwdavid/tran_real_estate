<script lang="ts">
	// UI-SPEC "PasteImport" (AGT-03): "Import from email" means paste. Tran never connects to an
	// inbox; the agent copies a lead email and pastes it here. TRAN-LEAD blocks are read exactly,
	// anything else gets one lead found by pattern, and every result goes through the ImportReview
	// dry run. The pasted text stays in this textarea and is never stored anywhere.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import SearchX from '@lucide/svelte/icons/search-x';
	import { onMount, tick } from 'svelte';
	import { diffLeads, type LeadDiff } from '@tran/core/leads/diff-leads';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button, Label, announce } from '$lib/features/shared/data/platform-ui';
	import { listContacts } from '$lib/storage/agent/contacts-repo';
	import ImportReview from './ImportReview.svelte';
	import { MAX_PASTE_CHARS, pasteToLeads } from './paste-to-leads';

	let { onaddlead }: { onaddlead: () => void } = $props();

	const uid = $props.id();
	const ids = {
		heading: `${uid}-heading`,
		text: `${uid}-text`,
		help: `${uid}-help`,
		error: `${uid}-error`,
		notFound: `${uid}-not-found`
	};

	let text = $state('');
	let checking = $state(false);
	let fieldError = $state<string | null>(null);
	let clipboardNote = $state<string | null>(null);
	let canPaste = $state(false);
	let notFound = $state(false);
	let skipped = $state<string[]>([]);
	let review = $state.raw<{ seq: number; diff: LeadDiff; editable?: Set<number> } | null>(null);
	let reviewSeq = 0;

	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let notFoundTitleEl = $state<HTMLElement | null>(null);

	onMount(() => {
		canPaste = typeof navigator.clipboard?.readText === 'function';
	});

	const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

	async function pasteFromClipboard() {
		clipboardNote = null;
		try {
			const pasted = await navigator.clipboard.readText();
			text = text.trim() === '' ? pasted : `${text}\n\n${pasted}`;
			fieldError = null;
			textareaEl?.focus();
		} catch {
			clipboardNote =
				"Your browser didn't allow reading the clipboard. Paste into the box instead (Ctrl+V, ⌘V, or long-press).";
		}
	}

	async function check() {
		if (checking) return;
		fieldError = null;
		notFound = false;
		skipped = [];
		review = null;

		const parsed = pasteToLeads(text);
		if (parsed.mode === 'empty') {
			fieldError = 'Paste an email before checking.';
			textareaEl?.focus();
			return;
		}
		if (parsed.mode === 'too-long') {
			fieldError = `This is more than ${MAX_PASTE_CHARS.toLocaleString('en-US')} characters. Paste fewer emails at a time.`;
			textareaEl?.focus();
			return;
		}
		const notes: string[] = [];
		if (parsed.newerVersion > 0) {
			notes.push(
				`${parsed.newerVersion} TRAN-LEAD ${plural(parsed.newerVersion, 'block', 'blocks')} came from a newer version of Tran and ${plural(parsed.newerVersion, 'was', 'were')} skipped.`
			);
		}
		if (parsed.invalid > 0) {
			notes.push(
				`${parsed.invalid} TRAN-LEAD ${plural(parsed.invalid, 'block', 'blocks')} couldn't be read and ${plural(parsed.invalid, 'was', 'were')} skipped.`
			);
		}
		skipped = notes;

		if (parsed.mode === 'none') {
			notFound = true;
			announce(
				"No lead details found. Tran couldn't find an email address or phone number in what you pasted."
			);
			await tick();
			notFoundTitleEl?.focus();
			return;
		}

		checking = true;
		try {
			const diff = diffLeads(parsed.leads, await listContacts());
			const c = diff.counts;
			const cant = c.conflict > 0 ? `, ${c.conflict} can't be imported` : '';
			review = {
				seq: ++reviewSeq,
				diff,
				...(parsed.mode === 'freeform'
					? { editable: new Set(parsed.leads.map((l) => l.rowNumber)) }
					: {})
			};
			announce(
				`Checked. ${c.new} new, ${c.update} updates, ${c.duplicate} already in contacts${cant}. Review before adding.`
			);
		} finally {
			checking = false;
		}
	}

	function reset() {
		review = null;
		notFound = false;
		skipped = [];
		textareaEl?.focus();
	}
</script>

<section id="paste" class="grid gap-6" aria-labelledby={ids.heading}>
	<h2 id={ids.heading} class="font-display text-heading font-semibold">Paste a lead email</h2>
	<div class="grid max-w-[640px] gap-6">
		<p class="text-base leading-[1.6]">
			Copy a lead email from your inbox and paste it here. Tran doesn't connect to your inbox;
			pasting is how leads get in. Emails from your Tran inquiry page include a TRAN-LEAD block,
			which Tran reads exactly.
		</p>
		<div class="grid gap-2">
			<Label for={ids.text} class="text-base leading-[1.6] font-semibold">Lead email text</Label>
			<Textarea
				id={ids.text}
				bind:ref={textareaEl}
				bind:value={text}
				spellcheck={false}
				autocomplete="off"
				disabled={checking}
				class="min-h-60"
				aria-invalid={fieldError ? 'true' : undefined}
				aria-describedby={fieldError ? `${ids.error} ${ids.help}` : ids.help}
				oninput={() => (fieldError = null)}
			/>
			{#if fieldError}
				<p id={ids.error} class="flex items-center gap-1 text-label text-destructive">
					<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
					{fieldError}
				</p>
			{/if}
			<p id={ids.help} class="text-label text-muted-foreground">
				Paste one or several emails. Nothing you paste is saved except the leads you choose to add.
			</p>
		</div>
		<div class="grid gap-2">
			<div class="flex flex-wrap gap-3">
				{#if canPaste}
					<Button
						variant="outline"
						class="min-h-11"
						disabled={checking}
						onclick={pasteFromClipboard}
					>
						<ClipboardPaste size={16} aria-hidden="true" />
						Paste from clipboard
					</Button>
				{/if}
				<Button class="min-h-11" disabled={checking} onclick={check}>
					{checking ? 'Checking…' : 'Check pasted text'}
				</Button>
			</div>
			{#if clipboardNote}
				<p class="text-label text-muted-foreground">{clipboardNote}</p>
			{/if}
		</div>
		{#each skipped as note, i (i)}
			<p class="text-label text-muted-foreground">{note}</p>
		{/each}
	</div>

	{#if notFound}
		<div
			class="grid max-w-[640px] grid-cols-[20px_1fr] gap-x-3 gap-y-2 rounded-lg border border-border bg-surface p-4"
			data-testid="paste-not-found"
		>
			<SearchX size={20} class="mt-0.5 text-foreground" aria-hidden="true" />
			<div class="grid gap-2">
				<p
					id={ids.notFound}
					bind:this={notFoundTitleEl}
					tabindex="-1"
					class="text-base leading-[1.6] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					No lead details found
				</p>
				<p class="text-base leading-[1.6]">
					Tran couldn't find an email address or phone number in what you pasted. Paste the whole
					email, including the TRAN-LEAD block if it has one, or add the lead by hand.
				</p>
				<div>
					<Button variant="outline" class="min-h-11" onclick={onaddlead}
						>Add one lead by hand</Button
					>
				</div>
			</div>
		</div>
	{/if}

	{#if review}
		{#key review.seq}
			<ImportReview
				kind="paste"
				diff={review.diff}
				editableRows={review.editable}
				oncancel={reset}
				ondone={() => (text = '')}
				onmore={reset}
			/>
		{/key}
	{/if}
</section>
