<script lang="ts">
	import type { Snippet } from 'svelte';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	let { href, children }: { href: string; children: Snippet } = $props();
</script>

<!-- Same tab by design (UI-SPEC); rel="external" makes Kit do a full navigation. -->
<a {href} rel="external" class="inline"
	>{@render children()}<ExternalLinkIcon
		size={14}
		aria-hidden="true"
		class="ml-1 inline align-baseline"
	/><span class="sr-only"> (opens external site)</span></a
>
