<script lang="ts" module>
	export interface ChartTable {
		caption: string;
		/** Header cells, the first one heading the month column. */
		columns: string[];
		rows: { label: string; cells: string[] }[];
	}
</script>

<script lang="ts">
	// The chart's data-table alternative (07-UI-SPEC item 8): every plotted value, month rows,
	// numeric cells right-aligned and tabular. The scroll wrapper is a focusable named region so
	// keyboard users can scroll a wide table.

	let { table }: { table: ChartTable } = $props();
</script>

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
					<th scope="row" class="px-3 py-2 text-left font-normal whitespace-nowrap">{row.label}</th>
					{#each row.cells as cell, i (i)}
						<td class="px-3 py-2 text-right whitespace-nowrap tabular-nums">{cell}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
