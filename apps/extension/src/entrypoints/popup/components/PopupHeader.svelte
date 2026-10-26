<script lang="ts">
	import { COPY } from '../../../lib/copy';
</script>

<header>
	<div class="row">
		<img src="/icon/32.png" width="32" height="32" alt="" />
		<div>
			<h1>{COPY.popupTitle}</h1>
			<p class="subtitle">{COPY.popupSubtitle}</p>
		</div>
	</div>
	<p class="purpose">{COPY.purpose}</p>
</header>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	img {
		flex: none;
	}

	h1 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.5;
		color: var(--color-foreground);
	}

	.subtitle,
	.purpose {
		font-size: 0.875rem;
		font-weight: 400;
		line-height: 1.4;
		color: var(--color-muted-foreground);
	}

	.purpose {
		margin-top: 8px;
	}
</style>
