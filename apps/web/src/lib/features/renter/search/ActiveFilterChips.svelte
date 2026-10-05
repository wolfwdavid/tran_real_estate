<script lang="ts">
	// 06-UI-SPEC active filter chips: one removable button per active filter value (0 calls).
	// Removing one moves focus to the next chip, or to the Filters control when none remain.
	import { tick } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import { activeFilterChips } from '@tran/core/renter';
	import type { RenterSearch } from './search-state.svelte';

	let { search, onEmpty }: { search: RenterSearch; onEmpty?: () => void } = $props();

	const chips = $derived(activeFilterChips(search.filters));
	let list = $state<HTMLUListElement | null>(null);

	async function remove(index: number, key: string) {
		search.removeFilter(key);
		await tick();
		const buttons = list?.querySelectorAll<HTMLButtonElement>('button') ?? [];
		if (buttons.length > 0) buttons[Math.min(index, buttons.length - 1)].focus();
		else onEmpty?.();
	}
</script>

{#if chips.length > 0}
	<ul bind:this={list} aria-label="Active filters" class="flex flex-wrap gap-2">
		{#each chips as chip, i (chip.key)}
			<li>
				<button
					type="button"
					aria-label={`Remove filter: ${chip.label}`}
					onclick={() => remove(i, chip.key)}
					class="inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-1 rounded-md border border-input bg-surface px-4 text-label font-semibold text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>
					{chip.label}
					<X class="size-4" aria-hidden="true" />
				</button>
			</li>
		{/each}
	</ul>
{/if}
