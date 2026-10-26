<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { countLabel, stateCopy, type PopupState } from '../../../lib/popup-model';

	let { state }: { state: PopupState } = $props();
</script>

<section aria-labelledby="count-heading">
	<h2 id="count-heading" class="sr-only">Sponsored cards on this page</h2>
	<div class="status" role="status" aria-live="polite">
		{#if state.kind === 'counting'}
			<p class="count">
				<span class="numeral">{state.count}</span>
				<span class="text">{countLabel(state.count)}</span>
			</p>
		{:else if state.kind === 'not-running' || state.kind === 'storage-error'}
			<p class="alert">
				<span class="icon"><TriangleAlert size={16} aria-hidden="true" /></span>
				<span class="text">{stateCopy(state)}</span>
			</p>
		{:else if state.kind !== 'loading'}
			<p class="text">{stateCopy(state)}</p>
		{/if}
	</div>
</section>

<style>
	.count {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 8px;
	}

	.numeral {
		font-size: 1.5rem;
		font-weight: 600;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
		color: var(--color-foreground);
	}

	.text {
		font-size: 1rem;
		font-weight: 400;
		line-height: 1.5;
		color: var(--color-muted-foreground);
	}

	.alert {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}

	/* Centres the 16px glyph on the first 24px text line. */
	.icon {
		display: inline-flex;
		flex: none;
		padding-top: 4px;
		color: var(--color-foreground);
	}
</style>
