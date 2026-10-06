<script lang="ts">
	// The investor overview body (07-UI-SPEC "Investor overview"): h1, lead, Analyze a deal, three
	// cards with live counts, and the disclaimer line. Presentational only: the page loads the
	// counts (reads only, 0 calls) and passes them in; null = still loading.
	import { resolve } from '$app/paths';
	import type { Component } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Calculator from '@lucide/svelte/icons/calculator';
	import ChartLine from '@lucide/svelte/icons/chart-line';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import SearchCheck from '@lucide/svelte/icons/search-check';
	import ButtonLink from '$lib/components/ui/ButtonLink.svelte';
	import { OVERVIEW_LOADING, overviewLines, type OverviewCounts } from './overview-counts';

	let { counts }: { counts: OverviewCounts | null } = $props();

	const lines = $derived(counts ? overviewLines(counts) : null);

	interface OverviewCard {
		key: 'deals' | 'buyBoxes' | 'markets';
		title: string;
		href: string;
		linkLabel: string;
		icon: Component<{ size?: number; class?: string; 'aria-hidden'?: 'true' }>;
	}

	const cards: OverviewCard[] = [
		{
			key: 'deals',
			title: 'Saved deals',
			href: resolve('/investor/deals/'),
			linkLabel: 'Open saved deals',
			icon: FolderOpen
		},
		{
			key: 'buyBoxes',
			title: 'Buy boxes',
			href: resolve('/investor/buy-boxes/'),
			linkLabel: 'Open buy boxes',
			icon: SearchCheck
		},
		{
			key: 'markets',
			title: 'Markets',
			href: resolve('/investor/markets/'),
			linkLabel: 'Open markets',
			icon: ChartLine
		}
	];
</script>

<div class="max-w-reading">
	<h1 class="font-display text-display font-semibold">Investor portal</h1>
	<p class="mt-4 max-w-[640px] text-base leading-[1.6] text-muted-foreground">
		Analyze a property, save the deals you want to revisit, and watch the ZIP codes you care about.
	</p>
	<div class="mt-6">
		<ButtonLink href={resolve('/investor/analyze/')} variant="primary">
			<Calculator size={16} aria-hidden="true" />
			Analyze a deal
		</ButtonLink>
	</div>
</div>

<ul class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3" data-overview-cards>
	{#each cards as card (card.key)}
		{@const Icon = card.icon}
		<!--
			Phase 2 stretched link (PortalCard): the single link's ::after covers the card, so the card
			is one tab stop with one accessible name; the focus ring is drawn on the card.
		-->
		<li
			class="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-card transition-[box-shadow,transform] duration-200 ease-out focus-within:shadow-card-hover hover:shadow-card-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring motion-safe:focus-within:-translate-y-0.5 motion-safe:hover:-translate-y-0.5"
			data-overview-card={card.key}
		>
			<Icon size={24} class="text-secondary" aria-hidden="true" />
			<h2 class="text-base leading-[1.6] font-semibold text-foreground">{card.title}</h2>
			<p class="text-base leading-[1.6] text-foreground tabular-nums" data-overview-count>
				{lines ? lines[card.key] : OVERVIEW_LOADING}
			</p>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- href is resolve() output -->
			<a
				href={card.href}
				class="mt-auto inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline decoration-1 underline-offset-[3px] after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
				>{card.linkLabel}<ArrowRight size={16} aria-hidden="true" /></a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</li>
	{/each}
</ul>

<p class="mt-6 text-label text-muted-foreground">
	Not investment, legal, or tax advice. Tran is software, not a brokerage.
</p>
