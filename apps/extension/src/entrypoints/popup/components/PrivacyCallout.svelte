<script lang="ts">
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { COPY } from '../../../lib/copy';
</script>

<aside>
	<span class="icon"><ShieldCheck size={20} aria-hidden="true" /></span>
	<div>
		<p class="heading">{COPY.privacyHeading}</p>
		<p class="body">{COPY.privacyBody}</p>
	</div>
</aside>

<style>
	aside {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 16px;
		border-left: 4px solid var(--color-secondary);
		border-radius: var(--radius-lg);
		background: var(--color-secondary-surface);
	}

	.icon {
		display: inline-flex;
		flex: none;
		padding-top: 2px;
		color: var(--color-secondary);
	}

	.heading,
	.body {
		font-size: 1rem;
		line-height: 1.5;
		color: var(--color-foreground);
	}

	.heading {
		font-weight: 600;
	}

	.body {
		font-weight: 400;
	}
</style>
