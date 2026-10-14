<script lang="ts">
	// Inline copies of the Lucide icons (ISC licence, @lucide/svelte 1.45.0 path data) used on the
	// calculator pages. Each @lucide/svelte icon builds into its own ~0.3 KB gz chunk, and five of
	// them were the difference between a tool page passing and failing the 60 KB gz budget (10-13).
	// Inline SVG compiles into the template string of the chunk that already ships.
	// The affordability calculator (shared/affordability) uses it too: on /tools/affordability/ the
	// Lucide runtime plus six icon chunks were ~3 KB gz of a page over budget (10-14).
	type Name =
		| 'server-off'
		| 'info'
		| 'arrow-right'
		| 'calculator'
		| 'circle-alert'
		| 'circle-check'
		| 'triangle-alert'
		| 'search';

	let {
		name,
		size = 24,
		class: className = ''
	}: { name: Name; size?: number; class?: string } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={['lucide', `lucide-${name}`, className]}
	aria-hidden="true"
	focusable="false"
>
	{#if name === 'server-off'}
		<path d="M7 2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5" />
		<path d="M10 10 2.5 2.5C2 2 2 2.5 2 5v3a2 2 0 0 0 2 2h6z" />
		<path d="M22 17v-1a2 2 0 0 0-2-2h-1" />
		<path d="M4 14a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16.5l1-.5.5.5-8-8H4z" />
		<path d="M6 18h.01" />
		<path d="m2 2 20 20" />
	{:else if name === 'info'}
		<circle cx="12" cy="12" r="10" />
		<path d="M12 16v-4" />
		<path d="M12 8h.01" />
	{:else if name === 'arrow-right'}
		<path d="M5 12h14" />
		<path d="m12 5 7 7-7 7" />
	{:else if name === 'calculator'}
		<rect width="16" height="20" x="4" y="2" rx="2" />
		<line x1="8" x2="16" y1="6" y2="6" />
		<line x1="16" x2="16" y1="14" y2="18" />
		<path d="M16 10h.01" />
		<path d="M12 10h.01" />
		<path d="M8 10h.01" />
		<path d="M12 14h.01" />
		<path d="M8 14h.01" />
		<path d="M12 18h.01" />
		<path d="M8 18h.01" />
	{:else if name === 'circle-check'}
		<circle cx="12" cy="12" r="10" />
		<path d="m16 9-5.5 5.5L8 12" />
	{:else if name === 'triangle-alert'}
		<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
		<path d="M12 9v4" />
		<path d="M12 17h.01" />
	{:else if name === 'search'}
		<path d="m21 21-4.34-4.34" />
		<circle cx="11" cy="11" r="8" />
	{:else}
		<circle cx="12" cy="12" r="10" />
		<line x1="12" x2="12" y1="8" y2="12" />
		<line x1="12" x2="12.01" y1="16" y2="16" />
	{/if}
</svg>
