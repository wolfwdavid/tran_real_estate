<script lang="ts">
	import { onMount } from 'svelte';
	import RenterNav from '$lib/features/renter/RenterNav.svelte';
	import { getShortlistRepo } from '$lib/features/renter/storage/shortlist-repo';

	let { children } = $props();

	// The nav's shortlist count follows the repo live, in the browser only: null while prerendering
	// (and if the database cannot open), so the static HTML never shows a count it cannot know.
	let shortlistCount = $state<number | null>(null);

	onMount(() => {
		const sub = getShortlistRepo()
			.liveCount()
			.subscribe({
				next: (n) => {
					shortlistCount = n;
				},
				error: () => {
					shortlistCount = null;
				}
			});
		return () => sub.unsubscribe();
	});
</script>

<!-- Renders inside the (app) layout's <main>, after the Data source status bar and AppNotice. -->
<RenterNav {shortlistCount} />
{@render children()}
