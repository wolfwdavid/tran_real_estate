<script lang="ts">
	// UI-SPEC "StageBoard" Move menu: the keyboard, screen-reader and touch path for every stage
	// move (WCAG 2.2 SC 2.5.7, Dragging Movements). The trigger is a 44px outline button named
	// "Move {Name}"; the menu is a radio group of the five stages with the current one checked.
	// Choosing the current stage closes the menu with no change; any other stage calls onmove.
	// Escape closes and returns focus to the trigger (bits-ui default).
	import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left';
	import { STAGES, STAGE_LABELS, type Contact, type Stage } from '@tran/core/agent/types';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { buttonVariants } from '$lib/features/shared/data/platform-ui';
	import { cn } from '$lib/utils.js';

	let { contact, onmove }: { contact: Contact; onmove: (stage: Stage) => void } = $props();

	// Writable derived: seeded from the contact's stage, then owned by the radio group binding.
	let value = $derived<string>(contact.stage);

	function pick(next: string) {
		if (next === contact.stage) return;
		if (!(STAGES as readonly string[]).includes(next)) return;
		onmove(next as Stage);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		aria-label="Move {contact.name}"
		data-move-for={contact.id}
		class={cn(buttonVariants({ variant: 'outline' }), 'h-11 min-h-11 px-4')}
	>
		<ArrowRightLeft size={16} aria-hidden="true" />
		Move
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="start">
		<DropdownMenu.Group>
			<DropdownMenu.Label>Move {contact.name} to</DropdownMenu.Label>
			<DropdownMenu.RadioGroup bind:value onValueChange={pick}>
				{#each STAGES as stage (stage)}
					<DropdownMenu.RadioItem value={stage}>{STAGE_LABELS[stage]}</DropdownMenu.RadioItem>
				{/each}
			</DropdownMenu.RadioGroup>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
