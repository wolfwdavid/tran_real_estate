<script lang="ts">
	// 10-UI-SPEC results `<dl>`: term left (muted), value right (semibold, tabular), 1px rule and 8px
	// vertical padding per row; term-over-value below 375px.
	interface Props {
		rows: readonly { term: string; value: string }[];
	}

	let { rows }: Props = $props();
</script>

<dl class="mt-4">
	{#each rows as row (row.term)}
		<div
			class="flex flex-col border-t border-border py-2 min-[375px]:flex-row min-[375px]:justify-between min-[375px]:gap-4"
		>
			<dt class="text-body text-muted-foreground">{row.term}</dt>
			<dd
				class="text-body font-semibold [overflow-wrap:anywhere] text-foreground tabular-nums min-[375px]:text-right"
			>
				{row.value}
			</dd>
		</div>
	{/each}
</dl>
