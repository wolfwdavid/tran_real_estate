<script lang="ts">
	// UI-SPEC "CsvImport" (AGT-07): choose a file, match its columns, review every change, then
	// import in one transaction. The file is read into memory with the browser's File API and
	// never stored; limits (5 MB, 5,000 data rows) are checked before any row is turned into a
	// lead. Steps appear progressively in one panel and earlier steps stay visible.
	import Upload from '@lucide/svelte/icons/upload';
	import {
		autoMap,
		checkRowCap,
		countDataRows,
		CsvError,
		detectDelimiter,
		MAX_CSV_BYTES,
		parseCsv,
		rowsToIncomingLeads,
		validateMapping,
		type MappingError,
		type MappingTarget,
		type RowReason
	} from '@tran/core/csv';
	import { diffLeads, type LeadDiff } from '@tran/core/leads/diff-leads';
	import { cleanText } from '@tran/core/leads/normalize';
	import { announce, buttonVariants } from '$lib/features/shared/data/platform-ui';
	import SectionError from '$lib/features/shared/settings/SectionError.svelte';
	import { listContacts } from '$lib/storage/agent/contacts-repo';
	import ColumnMapper from './ColumnMapper.svelte';
	import ImportReview from './ImportReview.svelte';
	import { decodeCsvBytes } from './decode';

	interface LoadedFile {
		name: string;
		headers: string[];
		samples: string[];
		/** Data rows only (the header is line 1, so the first data row is line 2). */
		rows: string[][];
	}

	interface Review {
		seq: number;
		diff: LeadDiff;
		invalid: { row: number; reason: RowReason }[];
		unknownStages: { row: number; value: string }[];
	}

	const uid = $props.id();
	const ids = { heading: `${uid}-heading`, file: `${uid}-file` };
	const SAMPLE_CHARS = 40;

	const ERRORS = {
		tooLarge: {
			title: 'This file is too large',
			body: 'Tran imports CSV files up to 5 MB. Split the file, or export fewer columns.'
		},
		notCsv: {
			title: "This file can't be read as CSV",
			body: 'Choose a .csv file saved as UTF-8. In Excel, use Save As and pick CSV UTF-8.'
		},
		noContacts: {
			title: 'This file has no contacts',
			body: 'The first row should hold column names, with one contact per row after it.'
		},
		tooManyRows: {
			title: 'This file has more than 5,000 contacts',
			body: 'Import it in parts of 5,000 rows or fewer.'
		}
	} as const;

	let inputEl = $state<HTMLInputElement | null>(null);
	let reading = $state(false);
	let checking = $state(false);
	let error = $state.raw<{ title: string; body: string } | null>(null);
	let errorSeq = $state(0);
	let file = $state.raw<LoadedFile | null>(null);
	let mapping = $state<MappingTarget[]>([]);
	let mappingErrors = $state.raw<readonly MappingError[]>([]);
	let review = $state.raw<Review | null>(null);
	let reviewSeq = 0;

	function clear() {
		file = null;
		mapping = [];
		mappingErrors = [];
		review = null;
	}

	function fail(e: { title: string; body: string }) {
		clear();
		error = e;
		errorSeq += 1;
	}

	function sampleFor(rows: readonly (readonly string[])[], col: number): string {
		for (const r of rows) {
			const v = cleanText(r[col] ?? '');
			if (v !== '') return v.length > SAMPLE_CHARS ? `${v.slice(0, SAMPLE_CHARS)}…` : v;
		}
		return '';
	}

	async function onFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const chosen = input.files?.[0];
		// Reset so choosing the same file again fires change, and so the file never lingers.
		input.value = '';
		if (!chosen || reading) return;
		error = null;
		clear();
		if (chosen.size > MAX_CSV_BYTES) return fail(ERRORS.tooLarge);

		reading = true;
		try {
			const { text } = decodeCsvBytes(await chosen.arrayBuffer());
			const lineEnd = text.search(/[\r\n]/);
			const delimiter = detectDelimiter(lineEnd === -1 ? text : text.slice(0, lineEnd));
			let parsed: string[][];
			try {
				parsed = parseCsv(text, delimiter);
			} catch (err) {
				if (err instanceof CsvError) return fail(ERRORS.notCsv);
				throw err;
			}
			const header = parsed[0];
			const dataRows = countDataRows(parsed);
			if (!header || header.every((h) => cleanText(h) === '') || dataRows === 0) {
				return fail(ERRORS.noContacts);
			}
			if (!checkRowCap(dataRows).ok) return fail(ERRORS.tooManyRows);

			const headers = header.map((h) => cleanText(h));
			const rows = parsed.slice(1);
			file = {
				name: chosen.name,
				headers,
				samples: headers.map((_, col) => sampleFor(rows, col)),
				rows
			};
			mapping = autoMap(headers);
		} finally {
			reading = false;
		}
	}

	function remap(column: number, target: MappingTarget) {
		mapping[column] = target;
		mappingErrors = [];
		review = null;
	}

	async function checkFile() {
		if (!file || checking) return;
		review = null;
		const errors = validateMapping(mapping);
		mappingErrors = errors;
		if (errors.length > 0) return;

		checking = true;
		try {
			const { leads, invalid, unknownStages } = rowsToIncomingLeads(
				file.rows,
				$state.snapshot(mapping),
				{ firstLine: 2 }
			);
			const diff = diffLeads(leads, await listContacts());
			const c = diff.counts;
			const cant = invalid.length + c.conflict;
			review = { seq: ++reviewSeq, diff, invalid, unknownStages };
			announce(
				`Checked. ${c.new} new, ${c.update} updates, ${c.duplicate} already in contacts${cant > 0 ? `, ${cant} can't be imported` : ''}. Review before adding.`
			);
		} finally {
			checking = false;
		}
	}

	function reset() {
		error = null;
		clear();
		inputEl?.focus();
	}
</script>

<section id="csv" class="grid gap-6" aria-labelledby={ids.heading}>
	<h2 id={ids.heading} class="font-display text-heading font-semibold">Import from a CSV file</h2>
	<div class="grid max-w-[640px] gap-6">
		<p class="text-base leading-[1.6]">
			Export contacts from your old CRM or spreadsheet as CSV, then choose the file here. You'll
			match columns and review every change before anything is added.
		</p>
		<div class="grid gap-2">
			<div>
				<label
					class={buttonVariants({
						variant: 'outline',
						class:
							'min-h-11 cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring'
					})}
				>
					<Upload size={16} aria-hidden="true" />
					{reading ? 'Reading file…' : 'Choose CSV file'}
					<input
						bind:this={inputEl}
						id={ids.file}
						type="file"
						accept=".csv,text/csv"
						class="sr-only"
						disabled={reading}
						onchange={onFile}
					/>
				</label>
			</div>
			{#if file}
				<p class="text-label break-words text-muted-foreground">
					{file.name}: {file.headers.length} columns, {countDataRows([file.headers, ...file.rows])} rows.
				</p>
			{/if}
		</div>
	</div>

	{#key errorSeq}
		{#if error}
			<SectionError title={error.title} body={error.body} focusOnMount class="max-w-[640px]" />
		{/if}
	{/key}

	{#if file}
		<ColumnMapper
			headers={file.headers}
			samples={file.samples}
			{mapping}
			errors={mappingErrors}
			{checking}
			onmap={remap}
			oncheck={checkFile}
			onreset={reset}
		/>
	{/if}

	{#if review}
		{#key review.seq}
			<ImportReview
				kind="csv"
				diff={review.diff}
				invalid={review.invalid}
				unknownStages={review.unknownStages}
				oncancel={() => (review = null)}
				ondone={() => {}}
				onmore={reset}
			/>
		{/key}
	{/if}
</section>
