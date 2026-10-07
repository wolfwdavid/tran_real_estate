<script lang="ts">
	// 09-UI-SPEC "AiDisclosureChecklist anatomy" (STU-03): the static 8-item "Before you post this
	// video" list. The boxes are plain, uncontrolled checkboxes: local to this page, never saved,
	// never gating an exit and never summarised as a state. They reset on reload. The same items
	// ride along in the copied script as "[ ]" lines (reel-export.ts reelFooter).
	import { REEL_CHECKLIST, REEL_CHECKLIST_FOOTNOTE } from './checklist';

	const id = $props.id();
</script>

<section aria-labelledby="{id}-heading" class="flex min-w-0 flex-col gap-4" data-reel-checklist>
	<h2 id="{id}-heading" class="font-display text-heading font-semibold text-foreground">
		Before you post this video
	</h2>
	<ul class="flex flex-col gap-2">
		{#each REEL_CHECKLIST as item, i (i)}
			<li class="flex min-h-11 cursor-pointer touch-manipulation items-start gap-2 py-2">
				<input
					id="{id}-item-{i}"
					type="checkbox"
					class="mt-1 size-5 shrink-0 cursor-pointer accent-primary"
				/>
				<label for="{id}-item-{i}" class="cursor-pointer text-base leading-[1.6] text-foreground"
					>{item}</label
				>
			</li>
		{/each}
	</ul>
	<p class="text-label text-muted-foreground">{REEL_CHECKLIST_FOOTNOTE}</p>
</section>
