<script lang="ts">
	// The agent portal home below its h1 (UI-SPEC "/agent/ home: AgentHome"; RESEARCH Pattern 10:
	// the queue greets the agent here, no redirect). Due today (compact TodayQueue) on the left;
	// Pipeline counts, the data-driven Get set up checklist and the hidden-heading Quick actions on
	// the right (one column below 1024px). With no contacts at all, the CRM empty state replaces Due
	// today and Pipeline while Get set up stays. Reads this browser's IndexedDB only.
	import Circle from '@lucide/svelte/icons/circle';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { STAGES, STAGE_LABELS } from '@tran/core/agent/types';
	import { stageCounts } from '@tran/core/crm';
	import { Button, buttonVariants, announce } from '$lib/features/shared/data/platform-ui';
	import { buildInquiryUrl } from '$lib/leads/inquiry-url';
	import { useContacts, useProfile } from '$lib/storage/agent/live.svelte';
	import CrmEmptyState from '../crm/CrmEmptyState.svelte';
	import QuickAddDialog from '../crm/QuickAddDialog.svelte';
	import TodayQueue from '../tasks/TodayQueue.svelte';
	import { inquiryConfigFor, setupChecklist, type SetupKey } from './setup-checklist';

	let { onadded }: { onadded?: () => void } = $props();

	const uid = $props.id();
	const contacts = useContacts();
	const profile = useProfile();

	const isEmpty = $derived(contacts.loaded && contacts.current.length === 0);
	const counts = $derived(stageCounts(contacts.current));
	const checklist = $derived(
		setupChecklist({ profile: profile.current, contacts: contacts.current })
	);
	const inquiryConfig = $derived(inquiryConfigFor(profile.current));

	let addOpen = $state(false);

	// Copy inquiry link: the status line stays until the next change; on a refused clipboard the
	// link is shown in a selected field so Ctrl+C / Cmd+C still works.
	let copyStatus = $state<string | null>(null);
	let copyFallback = $state<string | null>(null);
	let linkEl = $state<HTMLInputElement | null>(null);

	const inquiryUrl = () =>
		inquiryConfig
			? buildInquiryUrl(new URL(resolve('/agent/inquire/'), location.origin).href, inquiryConfig)
			: null;

	async function copyLink() {
		const url = inquiryUrl();
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			copyFallback = null;
			copyStatus = 'Link copied.';
			announce('Link copied.');
		} catch {
			copyFallback = url;
			copyStatus =
				"Your browser didn't allow copying. The link is selected, so press Ctrl+C or ⌘C.";
			await tick();
			linkEl?.focus();
			linkEl?.select();
		}
	}

	// Get set up rows (UI-SPEC "Agent home and navigation"). Done rows read the same text; the icon
	// and the hidden prefix carry the state. A variable, because Svelte trims the trailing space of
	// literal element text.
	const SETUP_LABELS: Readonly<Record<SetupKey, string>> = {
		details: 'Add your name, license, and mailing address',
		inquiry: 'Create your inquiry link',
		contact: 'Add your first contact'
	};
	const DONE_PREFIX = 'Done: ';
	const linkClass =
		'inline-flex min-h-11 items-center text-body text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
	const h2Class = 'font-display text-heading font-semibold text-foreground';
	const profileHref = resolve('/agent/profile/');
	const inquiryPageHref = resolve('/agent/profile/') + '#inquiry-page';
	const pipelineHref = (stage: string) => resolve('/agent/pipeline/') + '#stage-' + stage;
</script>

{#snippet setup()}
	{#if !checklist.allDone}
		<section aria-labelledby="{uid}-setup" data-section="get-set-up">
			<h2 id="{uid}-setup" class={h2Class}>Get set up</h2>
			<ol class="mt-4 flex flex-col gap-2">
				{#each checklist.items as item (item.key)}
					<li class="flex items-start gap-3">
						{#if item.done}
							<CircleCheck size={20} class="mt-3 shrink-0 text-secondary" aria-hidden="true" />
						{:else}
							<Circle size={20} class="mt-3 shrink-0 text-muted-foreground" aria-hidden="true" />
						{/if}
						{#if item.key === 'contact'}
							<button type="button" class="{linkClass} text-left" onclick={() => (addOpen = true)}
								>{#if item.done}<span class="sr-only">{DONE_PREFIX}</span>{/if}{SETUP_LABELS[
									item.key
								]}</button
							>
						{:else}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- hrefs are built from resolve() plus a hash -->
							<a href={item.key === 'details' ? profileHref : inquiryPageHref} class={linkClass}
								>{#if item.done}<span class="sr-only">{DONE_PREFIX}</span>{/if}{SETUP_LABELS[
									item.key
								]}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/if}
					</li>
				{/each}
			</ol>
		</section>
	{/if}
{/snippet}

{#snippet quickActions()}
	<section aria-labelledby="{uid}-quick" data-section="quick-actions">
		<h2 id="{uid}-quick" class="sr-only">Quick actions</h2>
		<div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
			<Button variant="outline" class="min-h-11" onclick={() => (addOpen = true)}>Add a lead</Button
			>
			<a
				href={resolve('/agent/import/')}
				class={buttonVariants({ variant: 'outline', class: 'min-h-11' })}>Import leads</a
			>
			{#if inquiryConfig}
				<Button variant="ghost" class="min-h-11" onclick={copyLink}>Copy inquiry link</Button>
			{/if}
		</div>
		{#if copyStatus}
			<p data-copy-status class="mt-2 text-label text-foreground">{copyStatus}</p>
		{/if}
		{#if copyFallback}
			<input
				bind:this={linkEl}
				readonly
				value={copyFallback}
				aria-label="Your inquiry link"
				class="mt-2 h-12 w-full min-w-0 rounded-md border border-input bg-card px-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			/>
		{/if}
	</section>
{/snippet}

<p class="mt-4 max-w-prose text-body text-muted-foreground">
	Today's follow-ups, your pipeline, and new leads, all stored in this browser.
</p>

{#if !contacts.loaded}
	<p class="mt-8 text-label text-muted-foreground">Loading your contacts&hellip;</p>
{:else if isEmpty}
	<CrmEmptyState onaddlead={() => (addOpen = true)} />
	<div class="mt-8 flex flex-col gap-8 lg:max-w-[480px]">
		{@render setup()}
	</div>
{:else}
	<div class="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
		<section aria-labelledby="{uid}-due" data-section="due-today" class="min-w-0">
			<h2 id="{uid}-due" class={h2Class}>Due today</h2>
			<TodayQueue variant="compact" />
		</section>
		<div class="flex min-w-0 flex-col gap-8">
			<section aria-labelledby="{uid}-pipeline" data-section="pipeline">
				<h2 id="{uid}-pipeline" class={h2Class}>Pipeline</h2>
				<ul class="mt-2 flex flex-col">
					{#each STAGES as stage (stage)}
						<li>
							<!-- eslint-disable svelte/no-navigation-without-resolve -- href is built from resolve() plus a hash -->
							<a
								href={pipelineHref(stage)}
								class="flex min-h-11 items-center border-b border-border text-body text-foreground tabular-nums underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								>{STAGE_LABELS[stage]} &middot; {counts[stage]}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</li>
					{/each}
				</ul>
			</section>
			{@render setup()}
			{@render quickActions()}
		</div>
	</div>
{/if}

<QuickAddDialog bind:open={addOpen} onadded={() => onadded?.()} />
