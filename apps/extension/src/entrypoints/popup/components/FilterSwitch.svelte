<script lang="ts">
	import { COPY } from '../../../lib/copy';

	let {
		enabled,
		disabled,
		onchange
	}: { enabled: boolean | null; disabled: boolean; onchange: (value: boolean) => void } = $props();
</script>

<label class="row" class:disabled>
	<span class="label">{COPY.switchLabel}</span>
	<span class="control">
		{#if enabled !== null}
			<span class="word" class:on={enabled} aria-hidden="true"
				>{enabled ? COPY.switchOn : COPY.switchOff}</span
			>
		{/if}
		<span class="switch">
			<input
				type="checkbox"
				role="switch"
				checked={enabled === true}
				{disabled}
				onchange={(e) => onchange(e.currentTarget.checked)}
			/>
			<span class="track" class:on={enabled === true} aria-hidden="true">
				<span class="thumb"></span>
			</span>
		</span>
	</span>
</label>

<style>
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-height: 48px;
		padding: 0 16px;
		background: var(--color-card);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		cursor: pointer;
	}

	.row.disabled {
		cursor: not-allowed;
	}

	@media (hover: hover) {
		.row:not(.disabled):hover {
			border-color: var(--color-border-strong);
		}
	}

	.label {
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.5;
		color: var(--color-foreground);
	}

	.control {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex: none;
	}

	.word {
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.4;
		color: var(--color-muted-foreground);
	}

	.word.on {
		color: var(--color-foreground);
	}

	.switch {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
	}

	/* The native checkbox stays in the a11y tree, invisible and stacked over the drawn track. */
	input {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: inherit;
	}

	.track {
		position: absolute;
		inset: 0;
		box-sizing: border-box;
		border: 2px solid var(--color-border-strong);
		border-radius: var(--radius-full);
		background: var(--color-card);
	}

	.track.on {
		border-color: var(--color-primary);
		background: var(--color-primary);
	}

	/* 20px thumb with a 2px inset: the track's 2px border supplies the inset on every side. */
	.thumb {
		position: absolute;
		top: 0;
		left: 0;
		width: 20px;
		height: 20px;
		border-radius: var(--radius-full);
		background: var(--color-border-strong);
		transition: transform var(--duration-fast) var(--ease-out);
	}

	.track.on .thumb {
		background: var(--color-background);
		transform: translateX(20px);
	}

	input:focus-visible + .track {
		outline: 2px solid var(--color-ring);
		outline-offset: 2px;
	}

	input:disabled + .track {
		opacity: 0.5;
	}

	@media (forced-colors: active) {
		.track,
		.track.on {
			border: 2px solid ButtonText;
		}

		.thumb,
		.track.on .thumb {
			background: ButtonText;
		}
	}
</style>
