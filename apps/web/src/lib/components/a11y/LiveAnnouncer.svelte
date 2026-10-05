<script lang="ts">
	import { announcerMessage } from './announcer.svelte';
</script>

<!-- Rendered ONCE in the root layout. The only live region in Phase 3 (polite, never assertive). -->
<div
	role="status"
	aria-live="polite"
	aria-atomic="true"
	class="sr-only"
	data-testid="live-announcer"
>
	{announcerMessage()}
</div>
