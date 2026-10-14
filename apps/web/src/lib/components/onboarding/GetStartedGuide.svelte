<script lang="ts">
	// Inline, modal-free first-run guide (UI-SPEC "GetStartedGuide", RESEARCH Pattern 8). The
	// prerendered HTML is the first-visit state (step 0), so first visits never shift layout. The
	// stored state is read in onMount only. Focus moves to the step heading on every step change and
	// never on load, except an explicit arrival at #get-started. The tour panel (steps 1-3) loads on
	// demand to keep the landing's initial JS small.
	import { onMount, tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import X from '@lucide/svelte/icons/x';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { GUIDE_INTRO_COPY as G } from '$lib/content/onboarding-guide';
	import PortalTile from './PortalTile.svelte';
	import { BTN } from './guide-buttons';
	import {
		readOnboarding,
		writeOnboarding,
		type OnboardingPortal,
		type OnboardingState
	} from './onboarding-state';
	import type TourPanelType from './TourPanel.svelte';

	const PORTALS: OnboardingPortal[] = ['renter', 'investor', 'agent'];
	const HASH = '#get-started';

	const portalHref: Record<OnboardingPortal, string> = {
		renter: resolve('/renter/'),
		investor: resolve('/investor/'),
		agent: resolve('/agent/')
	};
	const setupHref = (p: OnboardingPortal) => `${resolve('/setup/rentcast/')}?portal=${p}`;

	let view = $state<OnboardingState>({ status: 'new' });
	let TourPanel = $state<typeof TourPanelType>();
	let headingEl = $state<HTMLHeadingElement>();
	let stepEl = $state<HTMLHeadingElement>();
	let showEl = $state<HTMLButtonElement>();
	/** Set once onMount ran (stored state applied, listeners attached); specs wait on it. */
	let ready = $state(false);
	/**
	 * Bumped on every state change and tour request. The first tour step awaits the lazily loaded
	 * tour panel; only the latest request may apply, so a later Show me around, Hide this guide or
	 * other tile wins over that stale step.
	 */
	let version = 0;

	const compact = $derived(view.status === 'done' || view.status === 'hidden');
	const touring = $derived(
		view.status === 'touring' && view.portal !== undefined && (view.step ?? 0) > 0
	);
	const portal = $derived<OnboardingPortal>(view.portal ?? 'renter');
	const keep = () => (view.lastPortal ? { lastPortal: view.lastPortal } : {});

	async function loadTour() {
		TourPanel ??= (await import('./TourPanel.svelte')).default;
	}

	function save(next: OnboardingState) {
		version++;
		view = next;
		writeOnboarding(next);
	}

	async function focusEl(el: () => HTMLElement | undefined) {
		await tick();
		el()?.focus();
	}

	/** "Show me around" (hero, compact row, Settings) and "Change portal": step 0, focus the h2. */
	function showGuide() {
		save({ status: 'new', step: 0, ...keep() });
		void focusEl(() => headingEl);
	}

	async function go(step: 0 | 1 | 2 | 3, p: OnboardingPortal = portal) {
		if (step === 0) return showGuide();
		const at = ++version;
		await loadTour();
		if (at !== version) return;
		save({ status: 'touring', portal: p, step, ...keep() });
		void focusEl(() => stepEl);
	}

	function hide() {
		save({ status: 'hidden', ...keep() });
		announce(G.hidden);
		void focusEl(() => showEl);
	}

	function finish() {
		writeOnboarding({ status: 'done', lastPortal: portal });
	}

	onMount(() => {
		const stored = readOnboarding();
		if (stored.status === 'touring' && stored.portal && (stored.step ?? 0) > 0) {
			const at = version;
			void loadTour().then(() => {
				if (at === version) view = stored;
			});
		} else {
			view = stored;
		}
		const onHash = () => {
			if (location.hash === HASH) showGuide();
		};
		// Same-hash clicks (hero "Show me around" while already at #get-started) fire no hashchange.
		const onClick = (e: MouseEvent) => {
			const a = (e.target as Element | null)?.closest?.('a[href]');
			if (a instanceof HTMLAnchorElement && a.hash === HASH && a.pathname === location.pathname)
				showGuide();
		};
		addEventListener('hashchange', onHash);
		document.addEventListener('click', onClick);
		ready = true;
		return () => {
			removeEventListener('hashchange', onHash);
			document.removeEventListener('click', onClick);
		};
	});

	// Arrival at /#get-started (e.g. Settings "Show the tour again"): focus the h2. On a client-side
	// arrival the router's focus reset queues a timeout that re-applies the #fragment
	// (location.replace), which moves focus off the h2 to the body. A timeout queued here runs after
	// that one, so the focus sticks.
	afterNavigate(({ to }) => {
		if (to?.url.hash === HASH) setTimeout(() => void focusEl(() => headingEl));
	});
</script>

<section
	id="get-started"
	aria-labelledby="get-started-heading"
	data-ready={ready ? '' : undefined}
	class="bg-background py-12 md:py-16"
>
	<div class="mx-auto max-w-page px-6 md:px-8">
		<p class="text-label font-semibold tracking-[0.06em] text-secondary uppercase">{G.eyebrow}</p>
		<h2
			id="get-started-heading"
			tabindex="-1"
			bind:this={headingEl}
			class="mt-2 font-display text-heading font-semibold focus:outline-none"
		>
			{G.heading}
		</h2>

		{#if compact}
			<div
				class="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center md:p-6"
			>
				<p class="text-body sm:mr-auto">{G.compact.text}</p>
				<div class="flex flex-col gap-2 sm:flex-row sm:gap-4">
					<button type="button" class={BTN.outline} bind:this={showEl} onclick={showGuide}>
						{G.compact.show}
					</button>
					{#if view.lastPortal}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() output -->
						<a href={portalHref[view.lastPortal]} class={BTN.primary}>
							{G.compact.open(view.lastPortal)}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				</div>
			</div>
		{:else}
			<div class="mt-6 rounded-lg border border-border bg-card p-6 shadow-card md:p-8">
				<div class="flex justify-end">
					<button
						type="button"
						class="{BTN.base} -mt-2 -mr-2 min-h-11 px-3 text-foreground hover:bg-surface"
						onclick={hide}
					>
						<X size={16} aria-hidden="true" />{G.hide}
					</button>
				</div>

				{#if touring && TourPanel}
					<TourPanel
						{portal}
						step={view.step as 1 | 2 | 3}
						sampleHref="{portalHref[portal]}?source=sample"
						otherHref={portal === 'agent' ? portalHref.agent : setupHref(portal)}
						ongo={(s) => go(s)}
						onfinish={finish}
						bind:stepEl
					/>
				{:else}
					<p class="max-w-reading text-body">{G.lead}</p>
					<ul class="mt-6 grid gap-6 md:grid-cols-3">
						{#each PORTALS as p (p)}
							<li>
								<PortalTile
									portal={p}
									title={G.tiles[p].title}
									description={G.tiles[p].description}
									action={G.tiles[p].action}
									onchoose={() => go(1, p)}
								/>
							</li>
						{/each}
					</ul>
					<p class="mt-4 text-label text-muted-foreground">{G.helper}</p>
				{/if}
			</div>
		{/if}
	</div>
</section>
