<script lang="ts">
	// Stub: the "Saved searches" section (RENT-04) is filled by 06-20. Renders nothing yet; the prop
	// is the renter search controller a saved search row restores into (0 calls).
	import type { RenterSearch } from '../search/search-state.svelte';

	let { search }: { search: RenterSearch } = $props();
	// Accepted now so callers are final; 06-20 uses it.
	// svelte-ignore state_referenced_locally
	void search;
</script>

<!-- filled by 06-20 -->
