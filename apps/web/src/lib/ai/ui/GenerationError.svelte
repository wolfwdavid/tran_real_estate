<script lang="ts">
	// 05-UI-SPEC "GenerationError": the Phase 3 SectionError visual (card, 1px border, 4px
	// destructive left rule, CircleAlert 20px) plus one optional inline link into Settings.
	// Not a live region: GenerationPanel announces "{title}. {body}" once through the polite
	// LiveAnnouncer, so this renders with role removed from the Phase 3 alert.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { resolve } from '$app/paths';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
	import type { CopyLink } from './ai-copy';

	let {
		title,
		body,
		action = null,
		model
	}: { title: string; body: string; action?: CopyLink | null; model?: string } = $props();

	// The known model id is wrapped in <code>; everything else is plain text.
	const parts = $derived(model ? body.split(model) : [body]);
	const href = $derived(action ? `${resolve('/settings/')}#${action.hash}` : '');
</script>

<Alert variant="destructive" role={null} data-generation-error="">
	<CircleAlert class="size-5 text-destructive" aria-hidden="true" />
	<AlertTitle>{title}</AlertTitle>
	<AlertDescription>
		<p class="text-base leading-[1.6]">
			{#each parts as part, i (i)}{#if i > 0}<code>{model}</code>{/if}{part}{/each}
		</p>
		{#if action}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus a same-page fragment -->
			<a {href} class="text-base underline">{action.label}</a>
		{/if}
	</AlertDescription>
</Alert>
