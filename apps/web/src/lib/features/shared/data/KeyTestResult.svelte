<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import CircleQuestionMark from '@lucide/svelte/icons/circle-question-mark';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import type { KeyTestOutcome } from '@tran/core/request';
	import { formatRelative, toIso } from './relative-time';
	import {
		RENTCAST_HOST,
		keyFormatLine,
		keyTestLine,
		testedLine,
		type KeyFormatError
	} from './copy/source';

	// The RentCast "Test key" result line (04-UI-SPEC KeyTestResult). Plain text only: the caller
	// announces the result line through the shared announcer, so nothing here is a live region.
	// A failed format check shows Phase 3's field-style message and no "Tested" line (no request ran).

	interface Props {
		result: {
			outcome: KeyTestOutcome | 'bad-format';
			formatError?: KeyFormatError;
			/** When the test ran (epoch ms). */
			at: number;
		} | null;
		/** Clock for the relative "Tested" time; defaults to a once-a-minute tick. */
		now?: number;
	}

	let { result, now }: Props = $props();

	let tick = $state(Date.now());
	$effect(() => {
		if (now !== undefined || !result) return;
		const id = setInterval(() => (tick = Date.now()), 60_000);
		return () => clearInterval(id);
	});

	const clock = $derived(now ?? tick);
	const line = $derived(
		!result
			? ''
			: result.outcome === 'bad-format'
				? keyFormatLine(result.formatError ?? 'empty')
				: keyTestLine(result.outcome)
	);
	const hostAt = $derived(result?.outcome === 'unverified' ? line.indexOf(RENTCAST_HOST) : -1);
</script>

{#if result}
	<div class="grid gap-1">
		<p class="flex items-start gap-2 text-label text-foreground">
			{#if result.outcome === 'valid' || result.outcome === 'valid-billed'}
				<CircleCheck
					size={16}
					data-icon="circle-check"
					aria-hidden="true"
					class="mt-0.5 shrink-0 text-secondary"
				/>
			{:else if result.outcome === 'invalid' || result.outcome === 'bad-format'}
				<CircleAlert
					size={16}
					data-icon="circle-alert"
					aria-hidden="true"
					class="mt-0.5 shrink-0 text-destructive"
				/>
			{:else if result.outcome === 'restricted'}
				<ShieldAlert
					size={16}
					data-icon="shield-alert"
					aria-hidden="true"
					class="mt-0.5 shrink-0 text-foreground"
				/>
			{:else if result.outcome === 'unverified'}
				<CircleQuestionMark
					size={16}
					data-icon="circle-question-mark"
					aria-hidden="true"
					class="mt-0.5 shrink-0 text-muted-foreground"
				/>
			{:else}
				<Hourglass
					size={16}
					data-icon="hourglass"
					aria-hidden="true"
					class="mt-0.5 shrink-0 text-foreground"
				/>
			{/if}
			{#if hostAt >= 0}
				<span
					>{line.slice(0, hostAt)}<code>{RENTCAST_HOST}</code>{line.slice(
						hostAt + RENTCAST_HOST.length
					)}</span
				>
			{:else}
				<span>{line}</span>
			{/if}
		</p>
		{#if result.outcome !== 'bad-format'}
			<p class="text-label text-muted-foreground tabular-nums">
				{testedLine('')}<time datetime={toIso(result.at)}>{formatRelative(result.at, clock)}</time>
			</p>
		{/if}
	</div>
{/if}
