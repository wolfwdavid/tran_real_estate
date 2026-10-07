<script lang="ts" module>
	/** Shown in each meta slot (and the disclosure slot) until the browser has read the data. */
	export const STUDIO_LOADING = 'Loading your studio…';

	/** "{n} drafts saved" / "1 draft saved" / "No drafts yet" (09-UI-SPEC StudioToolCard). */
	export function draftsLine(n: number): string {
		if (n === 0) return 'No drafts yet';
		return n === 1 ? '1 draft saved' : `${n} drafts saved`;
	}

	/** "{n} snapshots saved" / "1 snapshot saved" / "No snapshots yet". */
	export function snapshotsLine(n: number): string {
		if (n === 0) return 'No snapshots yet';
		return n === 1 ? '1 snapshot saved' : `${n} snapshots saved`;
	}

	/** Phase 5 artifact `feature` ids of the three writing tools (one per prompt family). */
	export const STUDIO_DRAFT_FEATURES = {
		listing: 'studio-listing',
		social: 'studio-social',
		reel: 'studio-reel'
	} as const;
</script>

<script lang="ts">
	// 09-UI-SPEC "StudioHub": lead, DisclosureStatus, the four tool cards and the sample report
	// link. Prerendered: the cards and every href are static; the meta lines and the profile are
	// read in the browser after mount (Dexie by dynamic import, zero RentCast calls, no gateway).
	// The hub has no form, so the sample-profile variant never applies here.
	import { onMount } from 'svelte';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import FileText from '@lucide/svelte/icons/file-text';
	import MessagesSquare from '@lucide/svelte/icons/messages-square';
	import { resolve } from '$app/paths';
	import type { ProfileInput } from '@tran/core/agent/types';
	import { loadAgentProfile } from '$lib/features/shared/agent-profile';
	import DisclosureStatus from './DisclosureStatus.svelte';
	import StudioToolCard from './StudioToolCard.svelte';

	type CardKey = 'listing' | 'social' | 'reel' | 'snapshot';

	const cards = [
		{
			key: 'listing',
			href: resolve('/agent/studio/listing/'),
			title: 'Listing description',
			description:
				'Turn the facts you enter into a description in your tone, checked before you copy it.',
			linkText: 'Write a listing description',
			icon: FileText
		},
		{
			key: 'social',
			href: resolve('/agent/studio/social/'),
			title: 'Social post pack',
			description:
				'One brief becomes an Instagram, Facebook, and LinkedIn post, each with your disclosure and a character count.',
			linkText: 'Write a post pack',
			icon: MessagesSquare
		},
		{
			key: 'reel',
			href: resolve('/agent/studio/reel/'),
			title: 'Reel script',
			description:
				'A short founder-story video script with timed beats, captions, a B-roll list, and an AI-disclosure checklist.',
			linkText: 'Write a reel script',
			icon: Clapperboard
		},
		{
			key: 'snapshot',
			href: resolve('/agent/studio/snapshot/'),
			title: 'Market Snapshot',
			description: 'A branded market report for a ZIP code that you print or save as a PDF.',
			linkText: 'Build a Market Snapshot',
			icon: ChartColumn
		}
	] as const satisfies readonly { key: CardKey; [k: string]: unknown }[];

	const sampleReportHref = `${resolve('/print/snapshot/')}?id=sample`;

	// null = still loading. A count that cannot be read shows an empty meta line rather than a
	// wrong "No drafts yet"; the tool page shows the real Draft history.
	let meta = $state<Record<CardKey, string> | null>(null);
	let profile = $state.raw<ProfileInput | null>(null);
	let profileLoaded = $state(false);

	onMount(() => {
		let alive = true;
		const safe = (p: Promise<number>, line: (n: number) => string) => p.then(line).catch(() => '');
		void Promise.all([
			import('$lib/ai/storage/artifacts'),
			import('$lib/storage/studio/snapshots-repo')
		])
			.then(([{ createArtifactRepo }, { countSnapshots }]) => {
				const repo = createArtifactRepo();
				return Promise.all([
					safe(repo.countByFeature(STUDIO_DRAFT_FEATURES.listing), draftsLine),
					safe(repo.countByFeature(STUDIO_DRAFT_FEATURES.social), draftsLine),
					safe(repo.countByFeature(STUDIO_DRAFT_FEATURES.reel), draftsLine),
					safe(countSnapshots(), snapshotsLine)
				]);
			})
			.then(([listing, social, reel, snapshot]) => {
				if (alive) meta = { listing, social, reel, snapshot };
			})
			.catch(() => {
				if (alive) meta = { listing: '', social: '', reel: '', snapshot: '' };
			});
		void loadAgentProfile()
			.catch(() => null)
			.then((p) => {
				if (!alive) return;
				profile = p;
				profileLoaded = true;
			});
		return () => {
			alive = false;
		};
	});
</script>

<p class="mt-4 max-w-prose text-body text-muted-foreground">
	Write listing descriptions, social posts, and reel scripts from facts you enter, and build a
	branded market report for any ZIP code. Every draft is checked for Fair Housing problem phrases
	and gets your disclosure added.
</p>

<div class="mt-6 max-w-reading" data-studio-disclosure>
	{#if profileLoaded}
		<DisclosureStatus {profile} usingSample={false} />
	{:else}
		<p class="text-label text-muted-foreground">{STUDIO_LOADING}</p>
	{/if}
</div>

<ul class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2" data-studio-cards>
	{#each cards as card (card.key)}
		<li data-studio-card={card.key}>
			<StudioToolCard
				href={card.href}
				title={card.title}
				description={card.description}
				meta={meta ? meta[card.key] : STUDIO_LOADING}
				linkText={card.linkText}
				icon={card.icon}
			/>
		</li>
	{/each}
</ul>

<p class="mt-6 text-body text-foreground">
	<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus ?id=sample -->
	<a
		href={sampleReportHref}
		class="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-3 hover:text-primary-hover hover:decoration-2"
		>Preview a sample report</a
	>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</p>
