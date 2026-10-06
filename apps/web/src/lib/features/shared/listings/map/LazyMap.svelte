<script lang="ts">
	// Lazy wrapper for the listing map (06-19, RENT-02; 06-UI-SPEC "Map contract" Loading).
	//
	// The ONLY way to reach ListingMap (and with it Leaflet, supercluster and leaflet.css) is the
	// dynamic import below, which runs when this component mounts: the Map tab mounts it on first
	// selection. This file must never import leaflet or supercluster statically.
	import { onMount, type ComponentProps } from 'svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { Button } from '$lib/components/ui/button/index.js';
	import type ListingMap from './ListingMap.svelte';

	type Props = ComponentProps<typeof ListingMap> & {
		/** "Show list" on the failure panel (switches to the List tab). */
		onShowList?: () => void;
	};

	let { onShowList, ...mapProps }: Props = $props();

	/** The spinner appears only when loading takes longer than this (UI-SPEC). */
	const SHOW_LOADING_MS = 300;
	const importMap = () => import('./ListingMap.svelte');
	let load = $state(importMap());
	let failed = false;
	let slow = $state(false);

	$effect(() => {
		load.catch(() => (failed = true));
	});

	// "Choose the Map tab again": the panel stays mounted, so re-showing it retries a failed import.
	$effect(() => {
		if (mapProps.active && failed) {
			failed = false;
			load = importMap();
		}
	});

	onMount(() => {
		const timer = setTimeout(() => (slow = true), SHOW_LOADING_MS);
		return () => clearTimeout(timer);
	});
</script>

{#await load}
	<div
		data-map-loading
		class="flex h-[clamp(320px,60dvh,480px)] w-full items-center justify-center gap-2 rounded-lg bg-surface"
	>
		{#if slow}
			<LoaderCircle size={16} aria-hidden="true" class="motion-safe:animate-spin" />
			<p class="text-sm text-muted-foreground">Loading map…</p>
		{/if}
	</div>
{:then m}
	<m.default {...mapProps} />
{:catch}
	<div
		data-map-failed
		class="flex flex-col items-start gap-4 rounded-lg border border-border bg-surface p-4"
	>
		<p class="text-base leading-[1.6] text-foreground">
			The map didn't load. Check your connection, then choose the Map tab again. Every listing is
			still in the list.
		</p>
		<Button variant="outline" onclick={() => onShowList?.()}>Show list</Button>
	</div>
{/await}
