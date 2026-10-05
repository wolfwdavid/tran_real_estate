<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import CirclePause from '@lucide/svelte/icons/circle-pause';
	import SearchX from '@lucide/svelte/icons/search-x';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import { backoffMs, type GatewayError } from '@tran/core/request';
	import { cn } from '$lib/utils.js';
	import { Button, announce, buttonVariants } from './platform-ui';
	import { ACTION_LABELS, countdownLabel, errorCopy, rateLimitAnnouncements } from './copy/errors';

	// In-flow panel for one gateway failure (UI-SPEC GatewayError). Each taxonomy kind maps to one
	// message and one action set. Announced politely through the shared announcer, never as an
	// assertive alert. The 429 countdown is the only timer and it never retries on its own: a call is
	// spent only when the user clicks.

	interface Props {
		error: GatewayError;
		onTryAgain?: () => Promise<void>;
		onUseSample?: () => void;
		onContinuePastCap?: () => void;
		onEditSearch?: () => void;
		/** Move focus to the title on mount (when the panel replaced content after a user action). */
		focusOnMount?: boolean;
		/** Replaces the kind's body copy (e.g. a section-specific NoResults explanation). */
		body?: string;
		/** false hides the action row, for a panel whose actions don't apply where it is shown. */
		actions?: boolean;
	}

	let {
		error,
		onTryAgain,
		onUseSample,
		onContinuePastCap,
		onEditSearch,
		focusOnMount = false,
		body: bodyOverride,
		actions = true
	}: Props = $props();

	const titleId = $props.id();
	const copy = $derived.by(() => {
		const c = errorCopy(error);
		return bodyOverride ? { ...c, body: bodyOverride } : c;
	});
	const neutral = $derived(copy.variant === 'neutral');

	let titleEl = $state<HTMLElement | null>(null);
	/** Seconds left in the 429 wait; 0 = ready. */
	let remaining = $state(0);
	let pending = $state(false);

	// Re-runs only when a new error object arrives. Everything else is read untracked, so the
	// countdown ticks never re-trigger the announcement or the focus move.
	$effect(() => {
		const current = error;
		return untrack(() => {
			const { title, body } = errorCopy(current);
			announce(`${title}. ${bodyOverride ?? body}`);
			if (focusOnMount) titleEl?.focus();

			const seconds =
				current.kind === 'RateLimited'
					? Math.max(Math.ceil((current.retryInMs ?? backoffMs(0)) / 1000), 0)
					: 0;
			remaining = seconds;
			if (seconds === 0) return;
			announce(rateLimitAnnouncements.start(seconds));
			const timer = setInterval(() => {
				remaining -= 1;
				if (remaining <= 0) {
					clearInterval(timer);
					announce(rateLimitAnnouncements.END);
				}
			}, 1000);
			return () => clearInterval(timer);
		});
	});

	async function tryAgain() {
		if (pending || remaining > 0) return;
		pending = true;
		try {
			await onTryAgain?.();
		} finally {
			pending = false;
		}
	}

	const iconClass = $derived(
		cn('mt-0.5 shrink-0', neutral ? 'text-muted-foreground' : 'text-destructive')
	);
	const outlineLink = buttonVariants({ variant: 'outline' });
	const textLink = cn(buttonVariants({ variant: 'link' }), 'min-h-11');
</script>

{#snippet tryAgainButton()}
	<Button
		variant="outline"
		class="tabular-nums"
		aria-live="off"
		disabled={remaining > 0 || pending}
		onclick={tryAgain}>{remaining > 0 ? countdownLabel(remaining) : ACTION_LABELS.tryAgain}</Button
	>
{/snippet}

{#snippet useSampleButton()}
	<Button variant="ghost" onclick={() => onUseSample?.()}>{ACTION_LABELS.useSample}</Button>
{/snippet}

{#snippet checkKeyLink()}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus a same-page fragment -->
	<a href={`${resolve('/settings/')}#api-keys`} class={outlineLink}>{ACTION_LABELS.checkKey}</a>
{/snippet}

<section
	aria-labelledby={titleId}
	class={cn(
		'flex items-start gap-2 rounded-lg border border-border p-4 text-foreground sm:gap-4 sm:p-6',
		neutral ? 'bg-surface' : 'border-l-4 border-l-destructive bg-card'
	)}
>
	{#if error.kind === 'InvalidKey'}
		<KeyRound size={20} data-icon="key-round" aria-hidden="true" class={iconClass} />
	{:else if error.kind === 'RestrictedKey'}
		<ShieldAlert size={20} data-icon="shield-alert" aria-hidden="true" class={iconClass} />
	{:else if error.kind === 'RateLimited'}
		<Hourglass size={20} data-icon="hourglass" aria-hidden="true" class={iconClass} />
	{:else if error.kind === 'BudgetCapReached'}
		<CirclePause size={20} data-icon="circle-pause" aria-hidden="true" class={iconClass} />
	{:else if error.kind === 'NoResults'}
		<SearchX size={20} data-icon="search-x" aria-hidden="true" class={iconClass} />
	{:else if error.kind === 'NetworkError' && error.detail === 'server'}
		<CircleAlert size={20} data-icon="circle-alert" aria-hidden="true" class={iconClass} />
	{:else if error.kind === 'NetworkError'}
		<WifiOff size={20} data-icon="wifi-off" aria-hidden="true" class={iconClass} />
	{:else}
		<TriangleAlert size={20} data-icon="triangle-alert" aria-hidden="true" class={iconClass} />
	{/if}
	<div class="flex min-w-0 flex-col gap-2">
		<p
			id={titleId}
			bind:this={titleEl}
			tabindex="-1"
			class="text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			{copy.title}
		</p>
		<p data-testid="gateway-error-body" class="text-body tabular-nums">{copy.body}</p>
		{#if actions}<div
				data-testid="gateway-error-actions"
				class="flex flex-wrap items-center gap-2 sm:gap-4"
			>
				{#if error.kind === 'InvalidKey'}
					{@render checkKeyLink()}
					{@render useSampleButton()}
				{:else if error.kind === 'RestrictedKey'}
					{@render checkKeyLink()}
					<a href="https://app.rentcast.io/app/api" rel="external" class={textLink}>
						{ACTION_LABELS.openDashboard}
						<ExternalLinkIcon size={14} aria-hidden="true" /><span class="sr-only"
							>(opens external site)</span
						>
					</a>
				{:else if error.kind === 'RateLimited' || error.kind === 'NetworkError'}
					{@render tryAgainButton()}
				{:else if error.kind === 'BudgetCapReached'}
					<Button variant="outline" onclick={() => onContinuePastCap?.()}
						>{ACTION_LABELS.continuePastCap}</Button
					>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus a same-page fragment -->
					<a href={`${resolve('/settings/')}#rentcast-usage`} class={textLink}
						>{ACTION_LABELS.changeCap}</a
					>
				{:else if error.kind === 'NoResults'}
					<Button variant="outline" onclick={() => onEditSearch?.()}
						>{ACTION_LABELS.editSearch}</Button
					>
				{:else}
					{@render useSampleButton()}
				{/if}
			</div>{/if}
	</div>
</section>
