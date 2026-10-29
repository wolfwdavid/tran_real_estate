<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { PRIVACY_URL } from '../../../lib/site';
	import { COPY } from '../../../lib/copy';
</script>

<!-- A popup cannot navigate itself, so the link opens a tab: user navigation, not a request. -->
<footer>
	<p class="notice">{COPY.notAffiliated}</p>
	<a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
		{COPY.privacyLink}
		<ExternalLink size={14} aria-hidden="true" />
		<span class="sr-only">{COPY.privacyLinkHidden}</span>
	</a>
</footer>

<style>
	footer {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid var(--color-border);
	}

	.notice {
		font-size: 0.875rem;
		font-weight: 400;
		line-height: 1.4;
		color: var(--color-muted-foreground);
	}

	a {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 44px;
		font-size: 0.875rem;
		font-weight: 400;
		line-height: 1.4;
		color: var(--color-primary);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
	}

	@media (hover: hover) {
		a:hover {
			color: var(--color-primary-hover);
			text-decoration-thickness: 2px;
		}
	}

	a:focus-visible {
		outline: 2px solid var(--color-ring);
		outline-offset: 2px;
	}
</style>
