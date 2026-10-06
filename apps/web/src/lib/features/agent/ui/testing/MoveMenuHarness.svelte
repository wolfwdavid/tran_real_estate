<script lang="ts">
	// Test-only harness: a Move menu built from the dropdown-menu copy-in, as the board will use it.
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { STAGES, STAGE_LABELS, type Stage } from '@tran/core/agent/types';

	let { initial = 'new', onmove }: { initial?: Stage; onmove: (s: string) => void } = $props();
	// Writable derived: seeded from `initial`, then owned by the radio group binding.
	let value = $derived<string>(initial);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		id="move-trigger"
		class="inline-flex min-h-11 items-center border border-border px-4">Move</DropdownMenu.Trigger
	>
	<DropdownMenu.Content>
		<DropdownMenu.Group>
			<DropdownMenu.Label>Move Ana Ruiz to</DropdownMenu.Label>
			<DropdownMenu.RadioGroup
				bind:value
				onValueChange={(v) => {
					onmove(v);
				}}
			>
				{#each STAGES as stage (stage)}
					<DropdownMenu.RadioItem value={stage}>{STAGE_LABELS[stage]}</DropdownMenu.RadioItem>
				{/each}
			</DropdownMenu.RadioGroup>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
