<script lang="ts">
	// 07-UI-SPEC "Compare bar" (INV-03): in flow above the deal list (never sticky, so it can't hide
	// focus). The Compare link is a real link only with 2 or 3 deals selected; otherwise it renders
	// aria-disabled with no href and the reason linked by aria-describedby.
	import { MAX_COMPARE, MIN_COMPARE } from '@tran/core/finance';
	import { buttonVariants, Button } from '$lib/features/shared/data/platform-ui';
	import {
		COMPARE_CAP_REASON,
		COMPARE_MIN_REASON,
		compareBarStatus,
		compareHref
	} from './deals-view';

	interface Props {
		selected: readonly string[];
		/** A 4th selection was just refused: show the cap reason line. */
		capNotice: boolean;
		onclear: () => void;
	}

	let { selected, capNotice, onclear }: Props = $props();

	const n = $derived(selected.length);
	const ready = $derived(n >= MIN_COMPARE && n <= MAX_COMPARE);
	const label = $derived(`Compare ${Math.max(n, MIN_COMPARE)} deals`);
</script>

<section
	aria-label="Compare selection"
	class="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center"
	data-compare-bar
>
	<p class="text-base leading-[1.6] text-foreground tabular-nums" data-compare-status>
		{compareBarStatus(n)}
	</p>
	<div class="flex flex-wrap items-center gap-2">
		{#if ready}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- compareHref resolves the base -->
			<a href={compareHref(selected)} class={buttonVariants()}>{label}</a>
		{:else}
			<a
				role="link"
				tabindex="0"
				aria-disabled="true"
				aria-describedby="compare-min-reason"
				class={buttonVariants({
					class: 'border border-border bg-surface text-muted-foreground hover:bg-surface'
				})}>{label}</a
			>
		{/if}
		{#if n > 0}
			<Button variant="ghost" onclick={onclear}>Clear selection</Button>
		{/if}
	</div>
	{#if !ready}
		<p id="compare-min-reason" class="text-label text-muted-foreground sm:basis-full">
			{COMPARE_MIN_REASON}
		</p>
	{/if}
	{#if capNotice}
		<p class="text-label text-foreground sm:basis-full" data-compare-cap>{COMPARE_CAP_REASON}</p>
	{/if}
</section>
