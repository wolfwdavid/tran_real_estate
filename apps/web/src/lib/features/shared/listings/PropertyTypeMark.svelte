<script lang="ts">
	// 06-UI-SPEC "PropertyTypeMark": RentCast propertyType -> an illustrated mark (no photos) in an
	// accent-surface disc. Card: 48px mark in a 64px disc. Detail and empty states: 64px in 96px.
	// Decorative: the surrounding card text names the property type. Shared with Phase 7 (sales).
	import type { Component } from 'svelte';
	import RenterMark from '$lib/components/brand/marks/RenterMark.svelte';
	import CondoMark from './marks/CondoMark.svelte';
	import HomeMark from './marks/HomeMark.svelte';
	import ManufacturedMark from './marks/ManufacturedMark.svelte';
	import MultiFamilyMark from './marks/MultiFamilyMark.svelte';
	import SingleFamilyMark from './marks/SingleFamilyMark.svelte';
	import TownhouseMark from './marks/TownhouseMark.svelte';

	let { type, size = 'card' }: { type: string | null; size?: 'card' | 'detail' } = $props();

	// 'Apartment' reuses the Phase 2 RenterMark (no size prop; the disc sizes it, see below).
	const MARKS = new Map<string, Component<{ size?: number }>>([
		['Single Family', SingleFamilyMark],
		['Multi-Family', MultiFamilyMark],
		['Condo', CondoMark],
		['Townhouse', TownhouseMark],
		['Manufactured', ManufacturedMark]
	]);

	const apartment = $derived(type === 'Apartment');
	// Missing or unknown types (including 'Land' and 'Other') fall back to the plain home.
	const Mark = $derived((type === null ? undefined : MARKS.get(type)) ?? HomeMark);
	const markPx = $derived(size === 'detail' ? 64 : 48);
	// RenterMark (Phase 2) has a fixed 64px size, so the disc also sizes its svg child.
	const DISC = {
		card: 'size-16 [&>svg]:size-12',
		detail: 'size-24 [&>svg]:size-16'
	} as const;
</script>

<span
	data-property-mark={size}
	class="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-surface {DISC[
		size
	]}"
	aria-hidden="true"
>
	{#if apartment}
		<RenterMark />
	{:else}
		<Mark size={markPx} />
	{/if}
</span>
