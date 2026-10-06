<script lang="ts">
	// The /print/memo/ report sections (07-UI-SPEC "/print/memo/ content"), rendered as PrintReport
	// children: the memo text as plain paragraphs (no marks: the route only renders text that passed
	// every check) or the no-memo note, the key figures, and the three input tables with sources.
	// Every string comes from the tested print model.
	import type { ExpenseRow, KeyFigure, Row } from './print-model';
	import { PRINT_NO_MEMO_NOTE } from './print-model';

	let {
		memoText,
		figures,
		tables
	}: {
		/** null when the printout has no memo. */
		memoText: string | null;
		figures: KeyFigure[];
		tables: { purchase: Row[]; income: Row[]; expenses: ExpenseRow[]; expensesTotal: string };
	} = $props();

	const paragraphs = $derived(
		memoText === null
			? []
			: memoText
					.split(/\n\s*\n/)
					.map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
					.filter((p) => p !== '')
	);

	const TH = 'border-b border-foreground px-2 py-2 text-left text-label font-semibold';
	const TH_NUM = 'border-b border-foreground px-2 py-2 text-right text-label font-semibold';
	const TD = 'border-b border-border px-2 py-2 align-top';
	const TD_NUM =
		'border-b border-border px-2 py-2 text-right align-top whitespace-nowrap tabular-nums';
	const CAPTION = 'mb-2 text-left text-base leading-[1.6] font-semibold';
	// On screen each table scrolls inside its own focusable region, so a narrow phone (or the WCAG
	// 1.4.12 text-spacing overrides) never scrolls the page sideways. On paper it is plain flow.
	const SCROLL =
		'overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring print:overflow-visible';
</script>

{#if memoText !== null}
	<section aria-labelledby="report-memo" data-print-memo>
		<h2 id="report-memo" class="text-base leading-[1.6] font-semibold">Memo</h2>
		<div class="mt-2 flex flex-col gap-3">
			{#each paragraphs as p, i (i)}
				<p class="text-base leading-[1.6] font-normal">{p}</p>
			{/each}
		</div>
	</section>
{:else}
	<p class="text-base leading-[1.6] text-foreground" data-print-no-memo>{PRINT_NO_MEMO_NOTE}</p>
{/if}

<section aria-labelledby="report-figures" class="print-keep" data-print-figures>
	<h2 id="report-figures" class="text-base leading-[1.6] font-semibold">Key figures</h2>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div role="region" tabindex="0" aria-labelledby="report-figures" class="mt-2 {SCROLL}">
		<table class="w-full border-collapse text-base leading-[1.4]">
			<thead>
				<tr>
					<th scope="col" class={TH}>Metric</th>
					<th scope="col" class={TH_NUM}>Figure</th>
					<th scope="col" class={TH}>What it means</th>
				</tr>
			</thead>
			<tbody>
				{#each figures as f (f.metric)}
					<tr>
						<th scope="row" class="{TD} text-left font-semibold">{f.metric}</th>
						<td class={TD_NUM}>{f.figure}</td>
						<td class="{TD} text-label">{f.meaning}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<section aria-labelledby="report-inputs" data-print-inputs>
	<h2 id="report-inputs" class="text-base leading-[1.6] font-semibold">Inputs</h2>
	<div class="mt-2 flex flex-col gap-6">
		{#each [{ caption: 'Purchase and financing', rows: tables.purchase }, { caption: 'Income', rows: tables.income }] as t (t.caption)}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div role="region" tabindex="0" aria-label={t.caption} class={SCROLL}>
				<table class="w-full border-collapse text-base leading-[1.4]">
					<caption class={CAPTION}>{t.caption}</caption>
					<thead>
						<tr>
							<th scope="col" class={TH}>Item</th>
							<th scope="col" class={TH_NUM}>Amount</th>
							<th scope="col" class={TH}>Source</th>
						</tr>
					</thead>
					<tbody>
						{#each t.rows as r (r.item)}
							<tr>
								<th scope="row" class="{TD} text-left font-normal">{r.item}</th>
								<td class={TD_NUM}>{r.amount}</td>
								<td class={TD}>{r.source}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/each}

		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->

		<div role="region" tabindex="0" aria-label="Operating expenses" class={SCROLL}>
			<table class="w-full border-collapse text-base leading-[1.4]">
				<caption class={CAPTION}>Operating expenses</caption>
				<thead>
					<tr>
						<th scope="col" class={TH}>Expense</th>
						<th scope="col" class={TH}>Entered as</th>
						<th scope="col" class={TH_NUM}>Monthly amount</th>
						<th scope="col" class={TH}>Source</th>
					</tr>
				</thead>
				<tbody>
					{#each tables.expenses as e, i (i)}
						<tr>
							<th scope="row" class="{TD} text-left font-normal">{e.name}</th>
							<td class={TD}>{e.enteredAs}</td>
							<td class={TD_NUM}>{e.monthly}</td>
							<td class={TD}>{e.source}</td>
						</tr>
					{/each}
					<tr>
						<th scope="row" colspan="2" class="{TD} text-left font-semibold"
							>Total operating expenses</th
						>
						<td class="{TD_NUM} font-semibold">{tables.expensesTotal}</td>
						<td class={TD}></td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</section>
