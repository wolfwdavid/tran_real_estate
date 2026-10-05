<script lang="ts">
	import { resolve } from '$app/paths';
	import Gauge from '@lucide/svelte/icons/gauge';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CirclePause from '@lucide/svelte/icons/circle-pause';
	import { PLAN_LIMIT, meterState } from '@tran/core/budget';
	import {
		CAP_CAPTION,
		FREE_PLAN_CAPTION,
		SCOPE_NOTE,
		USAGE_LINK,
		compactCount,
		compactStateText,
		meterHeadline,
		meterSubline,
		notCountedLine,
		stateLine
	} from './copy/meter';

	// RentCast usage meter (UI-SPEC CallMeter). The visible text is the source of truth: the group
	// is named by its headline and the bar is decorative, so state is never conveyed by colour alone.
	// Props-driven only; the state comes from core meterState(), never from thresholds here.
	// The fill width changes instantly, never animated (animating width is banned in Phase 2).

	interface Props {
		/** Billed calls this month. */
		used: number;
		/** No-result requests this month (not billed). */
		unbilled: number;
		cap: number;
		/** First day of next month, 00:00 UTC (epoch ms). */
		resetsAt: number;
		variant: 'full' | 'compact';
		/** Unique prefix for the headline id. */
		id: string;
	}

	let { used, unbilled, cap, resetsAt, variant, id }: Props = $props();

	const state = $derived(meterState(used, cap));
	const left = $derived(Math.max(cap - used, 0));
	const scale = $derived(Math.max(PLAN_LIMIT, cap, used));
	const pct = (value: number) => (value / scale) * 100;
	const fillWidth = $derived(`${pct(used)}%`);
	const fillClass = $derived(
		state === 'ok' ? 'bg-secondary' : state === 'past' ? 'bg-destructive' : 'bg-primary'
	);
	const headlineId = $derived(`${id}-headline`);
	const linkClass =
		'inline-flex min-h-11 min-w-11 items-center text-body text-primary underline underline-offset-3 hover:text-primary-hover';
	const showFreeMarker = $derived(cap > PLAN_LIMIT);
	const line = $derived(stateLine(state, left));
	const word = $derived(compactStateText(state, left));

	/** Marker left edge, clamped so the 4px marker stays on the track. */
	const markerLeft = (value: number) => `clamp(0px, calc(${pct(value)}% - 2px), calc(100% - 4px))`;
	/** Caption left edge, clamped so the caption never overflows the column at 375px. */
	const captionLeft = (value: number, reserve: string) =>
		`clamp(0px, calc(${pct(value)}% - 1.5rem), calc(100% - ${reserve}))`;
</script>

{#snippet stateIcon(size: number)}
	{#if state === 'ok'}
		<Gauge {size} data-icon="gauge" aria-hidden="true" class="shrink-0 text-secondary" />
	{:else if state === 'at'}
		<CirclePause
			{size}
			data-icon="circle-pause"
			aria-hidden="true"
			class="shrink-0 text-foreground"
		/>
	{:else}
		<CircleAlert
			{size}
			data-icon="circle-alert"
			aria-hidden="true"
			class="shrink-0 {state === 'past' ? 'text-destructive' : 'text-foreground'}"
		/>
	{/if}
{/snippet}

{#snippet track(compact: boolean)}
	<div
		class="relative h-2 rounded-full border border-input bg-surface {compact ? 'w-24' : 'w-full'}"
	>
		<div
			data-testid="meter-fill"
			class="h-full max-w-full rounded-full {fillClass}"
			style:width={fillWidth}
		></div>
		<div
			class="absolute -top-1 h-4 w-1 rounded-sm bg-foreground"
			style:left={markerLeft(cap)}
		></div>
		{#if showFreeMarker}
			<div
				class="absolute -top-1 h-4 w-1 rounded-sm bg-foreground"
				style:left={markerLeft(PLAN_LIMIT)}
			></div>
		{/if}
	</div>
{/snippet}

{#if variant === 'full'}
	<div role="group" aria-labelledby={headlineId} class="flex w-full max-w-160 flex-col gap-2">
		<p id={headlineId} class="text-body font-semibold text-foreground tabular-nums">
			{meterHeadline(used)}
		</p>
		<div aria-hidden="true" class="flex flex-col gap-1 pt-1">
			{@render track(false)}
			<span
				class="mt-1 block w-fit text-label text-muted-foreground tabular-nums"
				style:margin-left={captionLeft(cap, '4rem')}>{CAP_CAPTION(cap)}</span
			>
			{#if showFreeMarker}
				<span
					class="block w-fit text-label text-muted-foreground tabular-nums"
					style:margin-left={captionLeft(PLAN_LIMIT, '7rem')}>{FREE_PLAN_CAPTION}</span
				>
			{/if}
		</div>
		<p class="flex items-center gap-2 text-label text-muted-foreground tabular-nums">
			{#if !line}{@render stateIcon(20)}{/if}<span>{meterSubline({ cap, used, resetsAt })}</span>
		</p>
		{#if line}
			<p class="flex items-start gap-2 text-body text-foreground tabular-nums">
				{@render stateIcon(20)}<span>{line}</span>
			</p>
		{/if}
		{#if unbilled > 0}
			<p class="text-label text-muted-foreground tabular-nums">{notCountedLine(unbilled)}</p>
		{/if}
		<p class="text-label text-muted-foreground">{SCOPE_NOTE}</p>
	</div>
{:else}
	<div
		role="group"
		aria-labelledby={headlineId}
		class="flex flex-wrap items-center gap-x-4 gap-y-2"
	>
		<span class="flex items-center gap-2">
			{@render stateIcon(16)}
			<span id={headlineId} class="text-body text-foreground tabular-nums"
				>RentCast calls: <span class="font-semibold">{compactCount(used)}</span> this month</span
			>
			<span aria-hidden="true" class="flex items-center py-1">{@render track(true)}</span>
		</span>
		<span class="flex flex-wrap items-center gap-2">
			<span class="text-label text-muted-foreground tabular-nums">{CAP_CAPTION(cap)}</span>
			{#if word}
				<span class="text-label font-semibold text-foreground tabular-nums">{word}</span>
			{/if}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus a same-page fragment -->
			<a href={`${resolve('/settings/')}#rentcast-usage`} class={linkClass}>{USAGE_LINK}</a>
		</span>
	</div>
{/if}
