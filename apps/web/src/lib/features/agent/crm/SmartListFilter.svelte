<script lang="ts">
	// UI-SPEC "SmartListFilter": All plus the three presets as toggle buttons, exactly one pressed.
	// Pressed uses the foreground inversion and a Check icon (not the accent); 44px tall.
	import Check from '@lucide/svelte/icons/check';
	import { SMART_LISTS, SMART_LIST_LABELS, type SmartList } from '@tran/core/crm';

	let {
		value = $bindable('all'),
		counts,
		onchange
	}: {
		value?: SmartList;
		counts: Record<SmartList, number>;
		onchange?: (list: SmartList) => void;
	} = $props();

	function pick(list: SmartList) {
		if (list === value) return;
		value = list;
		onchange?.(list);
	}
</script>

<div role="group" aria-label="Show" class="flex flex-wrap gap-2">
	{#each SMART_LISTS as list (list)}
		{@const pressed = list === value}
		<button
			type="button"
			aria-pressed={pressed}
			data-list={list}
			onclick={() => pick(list)}
			class={[
				'inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-1 rounded-md border px-4 text-base leading-[1.6] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
				pressed
					? 'border-foreground bg-foreground font-semibold text-card'
					: 'border-border-strong bg-transparent font-normal text-foreground hover:bg-surface'
			]}
		>
			{#if pressed}<Check class="size-4" aria-hidden="true" />{/if}
			{SMART_LIST_LABELS[list]}
			<span class="tabular-nums">({counts[list] ?? 0})</span>
		</button>
	{/each}
</div>
