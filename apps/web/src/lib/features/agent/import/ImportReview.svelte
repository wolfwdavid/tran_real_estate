<script lang="ts">
	// UI-SPEC "ImportReview" (AGT-03, AGT-07): the dry-run review shared by paste and CSV import.
	// Every row of the diffLeads result is shown with its outcome before anything is written; the
	// agent picks rows, and the commit is ONE Dexie transaction (planFromDiff + commitImport), so a
	// failure leaves the contacts exactly as they were. Free-form paste rows (editableRows) expose
	// Name / Email / Phone inputs because those values were found by pattern, not read from a
	// TRAN-LEAD block. Nothing here touches the network.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CopyCheck from '@lucide/svelte/icons/copy-check';
	import UserPen from '@lucide/svelte/icons/user-pen';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import { onMount, tick, untrack } from 'svelte';
	import { MediaQuery, SvelteSet } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import type { RowReason } from '@tran/core/csv';
	import type { FillableField, LeadDiff, LeadDiffRow } from '@tran/core/leads/diff-leads';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import {
		Badge,
		Button,
		buttonVariants,
		Input,
		Label,
		announce
	} from '$lib/features/shared/data/platform-ui';
	import SectionError from '$lib/features/shared/settings/SectionError.svelte';
	import {
		commitImport,
		planFromDiff,
		type ImportResult,
		type LeadEdits
	} from '$lib/storage/agent/import-commit';
	import { validateQuickAdd, type QuickAddField } from '../crm/quick-add';

	type Status = 'new' | 'update' | 'duplicate' | 'same' | 'cant';

	interface ReviewRow {
		row: number;
		status: Status;
		name: string;
		email: string;
		phone: string;
		badge: string;
		notes: string[];
		includable: boolean;
	}

	let {
		diff,
		kind,
		invalid = [],
		unknownStages = [],
		editableRows,
		oncancel,
		ondone,
		onmore
	}: {
		diff: LeadDiff;
		kind: 'paste' | 'csv';
		invalid?: { row: number; reason: RowReason }[];
		unknownStages?: { row: number; value: string }[];
		/** Row numbers whose name / email / phone were found by pattern and can be edited. */
		editableRows?: ReadonlySet<number>;
		/** Cancel: the parent removes the panel. */
		oncancel: () => void;
		/** The commit finished; the panel now shows the result. */
		ondone: (result: ImportResult) => void;
		/** "Import more" on the result: the parent resets its section. */
		onmore: () => void;
	} = $props();

	const uid = $props.id();
	const ids = { heading: `${uid}-heading`, result: `${uid}-result`, choose: `${uid}-choose` };
	const GROUP_LIMIT = 20;
	const GROUPS: readonly { status: Status; caption: string }[] = [
		{ status: 'new', caption: 'New contacts' },
		{ status: 'update', caption: 'Updates' },
		{ status: 'duplicate', caption: 'Already in contacts' },
		{ status: 'same', caption: 'Same person as an earlier row' },
		{ status: 'cant', caption: "Can't import" }
	];
	const FIELD_LABEL: Readonly<Record<FillableField, string>> = {
		email: 'email',
		phone: 'phone',
		propertyOfInterest: 'property',
		notes: 'notes'
	};
	const EDIT_FIELDS: readonly QuickAddField[] = ['name', 'email', 'phone'];
	const EDIT_LABEL: Readonly<Record<QuickAddField, string>> = {
		name: 'Name',
		email: 'Email',
		phone: 'Phone'
	};
	const REASON: Readonly<Record<RowReason, string>> = {
		'no-name': 'no name',
		'no-email-or-phone': 'no email or phone',
		'bad-email': 'email address looks incomplete',
		'short-phone': 'phone number is too short',
		'too-long': 'a value is too long to import'
	};
	// `kind` is fixed for a mounted review (parents remount through {#key}); $derived keeps the
	// compiler's initial-value warning away all the same.
	const sourceWord = $derived(kind === 'csv' ? 'file' : 'pasted email');

	const stageNotes = $derived(
		new Map(
			unknownStages.map((s) => [
				s.row,
				`stage "${s.value}" isn't a Tran stage, so it will start in New`
			])
		)
	);

	function fromDiffRow(r: LeadDiffRow): ReviewRow {
		const base = {
			row: r.lead.rowNumber,
			name: r.lead.name,
			email: r.lead.email,
			phone: r.lead.phone
		};
		const stageNote = stageNotes.get(r.lead.rowNumber);
		switch (r.kind) {
			case 'new':
				return {
					...base,
					status: 'new',
					badge: 'New contact',
					notes: stageNote ? [stageNote] : [],
					includable: true
				};
			case 'update': {
				const notes: string[] = [];
				const parts: string[] = [];
				if (r.fills.length > 0) {
					parts.push(`Adds ${r.fills.map((f) => FIELD_LABEL[f]).join(', adds ')}.`);
				}
				if (r.logsInquiry) parts.push('Logs the inquiry message.');
				if (parts.length > 0) notes.push(parts.join(' '));
				for (const k of r.keeps) {
					notes.push(
						`Keeps ${FIELD_LABEL[k.field]} ${k.existing} (${sourceWord} has ${k.incoming}).`
					);
				}
				if (stageNote) notes.push(stageNote);
				return {
					...base,
					status: 'update',
					badge: `Updates ${r.target.name}`,
					notes,
					includable: true
				};
			}
			case 'duplicate':
				return {
					...base,
					status: 'duplicate',
					badge: 'Already in contacts',
					notes: [`Matches ${r.target.name}. Nothing new to add.`],
					includable: false
				};
			case 'conflict':
				return {
					...base,
					status: 'cant',
					badge: "Can't import",
					notes: [
						`Row ${r.lead.rowNumber}: matches ${r.emailMatch.name} by email and ${r.phoneMatch.name} by phone, so add it by hand if needed`
					],
					includable: false
				};
			case 'same-as-row':
				return {
					...base,
					status: 'same',
					badge: `Same person as row ${r.firstRow}`,
					notes: [],
					includable: false
				};
		}
	}

	const rows: ReviewRow[] = $derived(
		[
			...diff.rows.map(fromDiffRow),
			...invalid.map((i): ReviewRow => ({
				row: i.row,
				status: 'cant',
				name: '',
				email: '',
				phone: '',
				badge: "Can't import",
				notes: [`Row ${i.row}: ${REASON[i.reason]}`],
				includable: false
			}))
		].sort((a, b) => a.row - b.row)
	);

	const groups = $derived(
		GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.status === g.status) })).filter(
			(g) => g.rows.length > 0
		)
	);
	const cantCount = $derived(invalid.length + diff.counts.conflict);
	const showCant = $derived(kind === 'csv' || cantCount > 0);

	// The agent's choices start from the rows as reviewed: parents remount this panel (through
	// {#key}) for every new check, so the initial rows are deliberately captured once.
	const initialRows = untrack(() => rows);
	const checked = new SvelteSet<number>(initialRows.filter((r) => r.includable).map((r) => r.row));
	const expanded = new SvelteSet<Status>();
	const wide = new MediaQuery('min-width: 1024px', false);
	const useTable = $derived(kind === 'csv' && wide.current);

	// Free-form rows: editable copies of the parsed values plus per-field errors.
	let edits = $state<Record<number, Record<QuickAddField, string>>>(
		Object.fromEntries(
			initialRows
				.filter((r) => untrack(() => editableRows)?.has(r.row))
				.map((r) => [r.row, { name: r.name, email: r.email, phone: r.phone }])
		)
	);
	let editErrors = $state<Record<number, Partial<Record<QuickAddField, string>>>>({});

	let busy = $state(false);
	let chooseError = $state(false);
	let failure = $state(false);
	let failureSeq = $state(0);
	let result = $state<ImportResult | null>(null);
	let headingEl = $state<HTMLElement | null>(null);
	let resultEl = $state<HTMLElement | null>(null);

	const count = $derived(checked.size);
	const commitLabel = $derived(
		kind === 'paste' ? `Add ${count} leads` : `Import ${count} contacts`
	);
	const busyLabel = $derived(kind === 'paste' ? 'Adding…' : 'Importing…');

	onMount(() => headingEl?.focus());

	const editId = (row: number, f: QuickAddField) => `${uid}-r${row}-${f}`;
	const contactLine = (r: ReviewRow) => [r.email, r.phone].filter((v) => v !== '').join(' · ');
	const displayName = (r: ReviewRow) => r.name || `Row ${r.row}`;
	const visible = (g: { status: Status; rows: ReviewRow[] }) =>
		expanded.has(g.status) ? g.rows : g.rows.slice(0, GROUP_LIMIT);

	function setChecked(row: number, on: boolean) {
		if (on) checked.add(row);
		else checked.delete(row);
		chooseError = false;
	}

	function selectAllNew() {
		for (const r of rows) if (r.includable) checked.add(r.row);
		chooseError = false;
	}

	function edited(row: number, f: QuickAddField) {
		if (editErrors[row]?.[f])
			editErrors = { ...editErrors, [row]: { ...editErrors[row], [f]: undefined } };
	}

	function cancel() {
		announce('Import canceled. Nothing changed.');
		oncancel();
	}

	/** Validates every checked editable row; focuses the first invalid field. */
	function validateEdits(): boolean {
		const next: typeof editErrors = {};
		let first: string | null = null;
		for (const r of rows) {
			const e = edits[r.row];
			if (!e || !checked.has(r.row)) continue;
			const v = validateQuickAdd(e);
			if (v.firstInvalid) {
				next[r.row] = v.errors;
				first ??= editId(r.row, v.firstInvalid);
			}
		}
		editErrors = next;
		if (first !== null) document.getElementById(first)?.focus();
		return first === null;
	}

	async function commit() {
		if (busy) return;
		failure = false;
		if (count === 0) {
			chooseError = true;
			announce('Choose at least one lead to add.');
			return;
		}
		if (!validateEdits()) return;
		busy = true;
		try {
			const leadEdits = new Map<number, LeadEdits>(
				Object.entries($state.snapshot(edits)).map(([row, e]) => [Number(row), e])
			);
			const plan = planFromDiff($state.snapshot(diff.rows), new Set(checked), leadEdits);
			const r = await commitImport(plan);
			result = r;
			announce(`Import complete. ${r.added} added, ${r.updated} updated, ${r.skipped} skipped.`);
			await tick();
			resultEl?.focus();
			ondone(r);
		} catch {
			// commitImport wraps every failure in ImportCommitError; nothing was written either way.
			failure = true;
			failureSeq += 1;
		} finally {
			busy = false;
		}
	}
</script>

{#snippet includeBox(r: ReviewRow)}
	<Checkbox
		checked={checked.has(r.row)}
		onCheckedChange={(v) => setChecked(r.row, v === true)}
		disabled={busy}
		aria-label={`Include ${displayName(r)}`}
		class="mt-0.5"
	/>
{/snippet}

{#snippet badge(r: ReviewRow)}
	{#if r.status === 'new'}
		<Badge variant="positive"><UserPlus size={14} aria-hidden="true" />{r.badge}</Badge>
	{:else if r.status === 'update'}
		<Badge class="text-foreground"><UserPen size={14} aria-hidden="true" />{r.badge}</Badge>
	{:else if r.status === 'cant'}
		<Badge class="bg-card text-destructive"
			><CircleAlert size={14} aria-hidden="true" />{r.badge}</Badge
		>
	{:else}
		<Badge><CopyCheck size={14} aria-hidden="true" />{r.badge}</Badge>
	{/if}
{/snippet}

{#snippet notes(r: ReviewRow)}
	{#each r.notes as note, i (i)}
		<p class="text-label text-muted-foreground">{note}</p>
	{/each}
{/snippet}

{#snippet editor(r: ReviewRow)}
	{@const e = edits[r.row]}
	{#if e}
		<p class="text-label text-muted-foreground">
			Found by pattern. Check these details before adding.
		</p>
		<div class="grid gap-4 sm:grid-cols-3">
			{#each EDIT_FIELDS as f (f)}
				{@const err = editErrors[r.row]?.[f]}
				<div class="grid gap-2">
					<Label for={editId(r.row, f)} class="text-base leading-[1.6] font-semibold">
						{EDIT_LABEL[f]}
					</Label>
					<Input
						id={editId(r.row, f)}
						value={e[f]}
						type={f === 'email' ? 'email' : f === 'phone' ? 'tel' : 'text'}
						maxlength={f === 'name' ? 120 : f === 'email' ? 254 : 40}
						autocomplete="off"
						disabled={busy}
						class="h-12"
						aria-invalid={err ? 'true' : undefined}
						aria-describedby={err ? `${editId(r.row, f)}-error` : undefined}
						oninput={(ev) => {
							e[f] = ev.currentTarget.value;
							edited(r.row, f);
						}}
					/>
					{#if err}
						<p
							id={`${editId(r.row, f)}-error`}
							class="flex items-center gap-1 text-label text-destructive"
						>
							<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
							{err}
						</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet card(r: ReviewRow)}
	<li class="grid gap-3 rounded-lg border border-border bg-card p-4" data-import-row={r.row}>
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="flex min-w-0 items-start gap-3">
				{#if r.includable}
					{@render includeBox(r)}
				{/if}
				<div class="min-w-0">
					<p class="text-base leading-[1.6] font-semibold break-words">{displayName(r)}</p>
					{#if contactLine(r) !== ''}
						<p class="text-label break-all text-muted-foreground">{contactLine(r)}</p>
					{/if}
				</div>
			</div>
			{@render badge(r)}
		</div>
		{@render notes(r)}
		{#if edits[r.row]}
			{@render editor(r)}
		{/if}
	</li>
{/snippet}

{#snippet showAll(g: { status: Status; rows: ReviewRow[] })}
	{#if g.rows.length > GROUP_LIMIT && !expanded.has(g.status)}
		<div>
			<Button variant="ghost" class="min-h-11" onclick={() => expanded.add(g.status)}>
				Show all {g.rows.length}
			</Button>
		</div>
	{/if}
{/snippet}

{#if result}
	<div class="rounded-lg border border-border bg-card p-6" data-testid="import-result">
		<h3
			id={ids.result}
			bind:this={resultEl}
			tabindex="-1"
			class="text-base leading-[1.6] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			Import complete
		</h3>
		<p class="mt-2 text-base leading-[1.6]">
			{result.added} added, {result.updated} updated, {result.skipped} skipped.
		</p>
		<div class="mt-4 flex flex-wrap gap-3">
			<a href={resolve('/agent/pipeline/')} class={buttonVariants({ variant: 'outline' })}
				>Open your pipeline</a
			>
			<Button variant="ghost" class="min-h-11" onclick={onmore}>Import more</Button>
		</div>
	</div>
{:else}
	<div
		class="grid gap-6 rounded-lg border border-border bg-card p-6"
		aria-busy={busy ? 'true' : undefined}
		data-testid="import-review"
	>
		<h3
			id={ids.heading}
			bind:this={headingEl}
			tabindex="-1"
			class="text-base leading-[1.6] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			Review before adding
		</h3>

		<dl class="flex flex-wrap gap-x-6 gap-y-1 text-base leading-[1.6] tabular-nums">
			<div class="flex gap-2">
				<dt class="font-semibold">New</dt>
				<dd>{diff.counts.new}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="font-semibold">Updates</dt>
				<dd>{diff.counts.update}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="font-semibold">Already in contacts</dt>
				<dd>{diff.counts.duplicate}</dd>
			</div>
			{#if showCant}
				<div class="flex gap-2">
					<dt class="font-semibold">Can't import</dt>
					<dd>{cantCount}</dd>
				</div>
			{/if}
		</dl>

		<div class="flex flex-wrap gap-2">
			<Button variant="ghost" class="min-h-11" disabled={busy} onclick={selectAllNew}>
				Select all new
			</Button>
			<Button
				variant="ghost"
				class="min-h-11"
				disabled={busy}
				onclick={() => {
					checked.clear();
					chooseError = false;
				}}
			>
				Clear all
			</Button>
		</div>

		{#if kind === 'paste'}
			<ul class="grid gap-3">
				{#each rows as r (r.row)}
					{@render card(r)}
				{/each}
			</ul>
		{:else if useTable}
			{#each groups as g (g.status)}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="relative overflow-x-auto" tabindex="0" role="region" aria-label={g.caption}>
					<table class="w-full min-w-[40rem] border-collapse text-base leading-[1.6]">
						<caption class="mb-2 text-left font-semibold">{g.caption} ({g.rows.length})</caption>
						<thead>
							<tr class="border-b border-border">
								<th scope="col" class="py-2 pr-4 text-left font-semibold">Include</th>
								<th scope="col" class="py-2 pr-4 text-left font-semibold">Name</th>
								<th scope="col" class="py-2 pr-4 text-left font-semibold">Email</th>
								<th scope="col" class="py-2 pr-4 text-left font-semibold">Phone</th>
								<th scope="col" class="py-2 text-left font-semibold">Status</th>
							</tr>
						</thead>
						<tbody>
							{#each visible(g) as r (r.row)}
								<tr class="border-b border-border align-top" data-import-row={r.row}>
									<td class="py-2 pr-4">
										{#if r.includable}
											{@render includeBox(r)}
										{/if}
									</td>
									<td class="py-2 pr-4 font-semibold">{displayName(r)}</td>
									<td class="py-2 pr-4 break-all">{r.email}</td>
									<td class="py-2 pr-4">{r.phone}</td>
									<td class="grid gap-1 py-2">
										<div>{@render badge(r)}</div>
										{@render notes(r)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{@render showAll(g)}
			{/each}
		{:else}
			{#each groups as g (g.status)}
				<div class="grid gap-3">
					<h4 class="text-base leading-[1.6] font-semibold">{g.caption} ({g.rows.length})</h4>
					<ul class="grid gap-3">
						{#each visible(g) as r (r.row)}
							{@render card(r)}
						{/each}
					</ul>
					{@render showAll(g)}
				</div>
			{/each}
		{/if}

		{#key failureSeq}
			{#if failure}
				<SectionError
					title="Import didn't finish"
					body="Nothing was added, and your contacts are as they were. Try again."
					focusOnMount
				/>
			{/if}
		{/key}

		<div class="grid gap-2">
			<div class="flex flex-wrap gap-3">
				<Button variant="outline" class="min-h-11" disabled={busy} onclick={cancel}>Cancel</Button>
				<Button
					class="min-h-11"
					disabled={busy}
					aria-describedby={chooseError ? ids.choose : undefined}
					onclick={commit}
				>
					{busy ? busyLabel : commitLabel}
				</Button>
			</div>
			{#if chooseError}
				<p id={ids.choose} class="flex items-center gap-1 text-label text-destructive">
					<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
					Choose at least one lead to add.
				</p>
			{/if}
		</div>
	</div>
{/if}
