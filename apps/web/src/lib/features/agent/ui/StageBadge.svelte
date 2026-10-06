<script lang="ts">
	// Text-only stage badge (Phase 3 badge shape: surface fill, foreground text, Label 14/600,
	// radius-full). Stages are told apart by their names, never by colour. Classes are written out
	// rather than passed through cn(): tailwind-merge would drop text-label next to text-foreground.
	import { STAGE_LABELS, type Stage } from '@tran/core/agent/types';

	let { stage }: { stage: Stage } = $props();
</script>

<span
	data-slot="badge"
	data-stage={stage}
	class="inline-flex items-center rounded-full bg-surface px-2 py-1 text-label font-semibold whitespace-nowrap text-foreground"
	>{STAGE_LABELS[stage]}</span
>
