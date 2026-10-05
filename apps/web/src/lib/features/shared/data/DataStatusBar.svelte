<script lang="ts" module>
	export type DataStatus =
		| 'hydrating'
		| { kind: 'sample'; reason: 'no-key' | 'locked' | 'chosen' }
		| {
				kind: 'live';
				/** Billed calls this month. */
				used: number;
				/** No-result requests this month (not billed). */
				unbilled: number;
				cap: number;
				/** First day of next month, 00:00 UTC (epoch ms). */
				resetsAt: number;
				/** Due saved searches still waiting for room under the cap. */
				waiting: number;
				/** The scheduler skipped due searches because the cap was already reached. */
				skippedForCap: boolean;
		  };
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import CirclePause from '@lucide/svelte/icons/circle-pause';
	import CallMeter from './CallMeter.svelte';
	import {
		ALERTS_SKIPPED_LINK,
		SAMPLE_LABEL,
		STATUS_HYDRATING,
		alertsSkipped,
		alertsWaiting,
		sampleExplanation,
		type SettingsLink
	} from './copy/source';

	// The slim bar under the header on every (app) route except /settings/ (04-UI-SPEC DataStatusBar).
	// A named region inside <main>, deliberately NOT a live region: state changes are announced by
	// whoever changes them. Props-driven: the (app) layout computes `status` after onMount; the
	// prerendered shell shows the hydrating text. Content wraps, so 375px never scrolls sideways.
	// Links: no key -> /settings/#api-keys, locked -> #key-security, chosen or at cap -> #rentcast-usage.

	let { status }: { status: DataStatus } = $props();

	const sample = $derived(
		status !== 'hydrating' && status.kind === 'sample' ? sampleExplanation(status.reason) : null
	);
	const bg = $derived(sample ? 'bg-accent-surface' : 'bg-background');
	const linkClass =
		'inline-flex min-h-11 items-center text-body text-primary underline underline-offset-3 hover:text-primary-hover';
	const href = (link: SettingsLink) => `${resolve('/settings/')}${link.hash}`;
</script>

{#snippet settingsLink(link: SettingsLink)}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus a same-page fragment -->
	<a href={href(link)} class={linkClass}>{link.text}</a>
{/snippet}

<div role="region" aria-label="Data source" class="w-full border-b border-border {bg}">
	<div class="mx-auto flex min-h-11 max-w-page flex-col justify-center gap-2 px-6 py-2 md:px-8">
		{#if status === 'hydrating'}
			<p class="flex flex-wrap items-center text-label text-muted-foreground">
				{STATUS_HYDRATING}
			</p>
		{:else if sample}
			<p class="flex flex-wrap items-center gap-x-2 text-body text-foreground">
				<FlaskConical
					size={20}
					data-icon="flask-conical"
					aria-hidden="true"
					class="shrink-0 text-foreground"
				/>
				<span class="font-semibold">{SAMPLE_LABEL}</span>
				<span>{sample.text}</span>
				{@render settingsLink(sample.link)}
			</p>
		{:else if status.kind === 'live'}
			<div class="flex flex-wrap items-center">
				<CallMeter
					used={status.used}
					unbilled={status.unbilled}
					cap={status.cap}
					resetsAt={status.resetsAt}
					variant="compact"
					id="data-status-meter"
				/>
			</div>
			{#if status.skippedForCap && status.waiting > 0}
				<p class="flex flex-wrap items-center gap-x-2 text-body text-foreground tabular-nums">
					<CirclePause
						size={16}
						data-icon="circle-pause"
						aria-hidden="true"
						class="shrink-0 text-foreground"
					/>
					<span>{alertsSkipped(status.waiting)}</span>
					{@render settingsLink(ALERTS_SKIPPED_LINK)}
				</p>
			{:else if status.waiting > 0}
				<p class="flex flex-wrap items-center text-body text-foreground tabular-nums">
					{alertsWaiting(status.waiting)}
				</p>
			{/if}
		{/if}
	</div>
</div>
