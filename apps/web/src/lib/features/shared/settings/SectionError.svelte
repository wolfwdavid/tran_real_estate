<script lang="ts">
	import { onMount } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';

	// Error panel for a failed sub-group (UI-SPEC SectionError). Phase 3 never uses role="alert" or
	// assertive regions: the message is announced once through the polite LiveAnnouncer instead.

	interface Props {
		title: string;
		body: string;
		/** Move focus here on mount (when this alert replaced a panel). */
		focusOnMount?: boolean;
		/** Announce on mount (off for alerts present in the prerendered HTML). */
		announceOnMount?: boolean;
		class?: string;
	}

	let {
		title,
		body,
		focusOnMount = false,
		announceOnMount = true,
		class: className
	}: Props = $props();

	let ref = $state<HTMLElement | null>(null);

	onMount(() => {
		if (announceOnMount) announce(`${title}. ${body}`);
		if (focusOnMount) ref?.focus();
	});
</script>

<Alert bind:ref variant="destructive" role={null} tabindex={-1} class={className}>
	<CircleAlert class="size-5 text-destructive" aria-hidden="true" />
	<AlertTitle>{title}</AlertTitle>
	<AlertDescription>{body}</AlertDescription>
</Alert>
