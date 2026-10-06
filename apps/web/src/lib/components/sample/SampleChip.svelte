<script lang="ts">
	// Phase 4 ProvenanceChip sample variant, unchanged (accent-surface, foreground, 1px border-strong,
	// FlaskConical 14px, "Sample data"). Lives outside features/ so the (public) inquiry demo can use it.
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
</script>

<span
	data-sample-chip
	class="inline-flex items-center gap-1 rounded-full border border-border-strong bg-accent-surface px-2 py-1 text-label font-semibold whitespace-nowrap text-foreground"
>
	<FlaskConical class="size-3.5" aria-hidden="true" />
	Sample data
</span>
