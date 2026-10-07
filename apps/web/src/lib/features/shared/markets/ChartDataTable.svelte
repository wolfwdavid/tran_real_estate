<script lang="ts" module>
	export interface ChartTable {
		caption: string;
		/** Header cells, the first one heading the month column. */
		columns: string[];
		rows: { label: string; cells: string[] }[];
	}

	/**
	 * Print layout (Phase 9): how many side-by-side blocks a table's months are split into. A
	 * narrow table (month + 1 value) prints 3-up and a month + 2-3 value table 2-up, so a 24-month
	 * table does not run down a whole page; wider tables print as one block.
	 */
	export function printBlocks(columns: number): number {
		if (columns <= 2) return 3;
		if (columns <= 4) return 2;
		return 1;
	}

	/** Splits rows into `n` consecutive, near-equal blocks (earlier blocks take the remainder). */
	export function splitRows<T>(rows: readonly T[], n: number): T[][] {
		const size = Math.ceil(rows.length / Math.max(1, n));
		const out: T[][] = [];
		for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
		return out.length > 0 ? out : [[]];
	}
</script>

<script lang="ts">
	// The chart's data-table alternative (07-UI-SPEC item 8): every plotted value, month rows,
	// numeric cells right-aligned and tabular. The scroll wrapper is a focusable named region so
	// keyboard users can scroll a wide table.
	//
	// Print (Phase 9): a sheet cannot scroll, so every value must sit inside the page box. Cells use
	// the Label 14px role with tight padding and may wrap, and a narrow table's months are split
	// into side-by-side blocks (printBlocks). Every month still appears exactly once.

	let { table, print = false }: { table: ChartTable; print?: boolean } = $props();

	const blocks = $derived(print ? splitRows(table.rows, printBlocks(table.columns.length)) : []);
</script>

{#if print}
	<div data-chart-table-print>
		<p class="pb-1 text-label text-muted-foreground">{table.caption}</p>
		<div
			class="grid gap-x-4 {blocks.length === 3
				? 'grid-cols-3'
				: blocks.length === 2
					? 'grid-cols-2'
					: 'grid-cols-1'}"
		>
			{#each blocks as block, b (b)}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					role="region"
					tabindex="0"
					aria-label={blocks.length > 1
						? `${table.caption} (part ${b + 1} of ${blocks.length})`
						: table.caption}
					class="min-w-0 overflow-x-auto"
				>
					<table class="w-full border-collapse text-label text-foreground">
						<caption class="sr-only">
							{blocks.length > 1
								? `${table.caption} (part ${b + 1} of ${blocks.length})`
								: table.caption}
						</caption>
						<thead>
							<tr>
								{#each table.columns as col, i (i)}
									<th
										scope="col"
										class="border-b border-border px-2 py-0.5 font-semibold {i === 0
											? 'text-left'
											: 'text-right'}">{col}</th
									>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each block as row (row.label)}
								<tr class="border-b border-border last:border-b-0">
									<th scope="row" class="px-2 py-0.5 text-left font-normal whitespace-nowrap"
										>{row.label}</th
									>
									{#each row.cells as cell, i (i)}
										<td class="px-2 py-0.5 text-right tabular-nums">{cell}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div role="region" tabindex="0" aria-label={table.caption} class="overflow-x-auto rounded-md">
		<table class="w-full border-collapse text-base leading-[1.6] text-foreground">
			<caption class="pb-2 text-left text-label text-muted-foreground">{table.caption}</caption>
			<thead class="bg-surface">
				<tr>
					{#each table.columns as col, i (i)}
						<th
							scope="col"
							class="border-b border-border px-3 py-2 font-semibold whitespace-nowrap {i === 0
								? 'text-left'
								: 'text-right'}">{col}</th
						>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each table.rows as row (row.label)}
					<tr class="border-b border-border last:border-b-0">
						<th scope="row" class="px-3 py-2 text-left font-normal whitespace-nowrap"
							>{row.label}</th
						>
						{#each row.cells as cell, i (i)}
							<td class="px-3 py-2 text-right whitespace-nowrap tabular-nums">{cell}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
