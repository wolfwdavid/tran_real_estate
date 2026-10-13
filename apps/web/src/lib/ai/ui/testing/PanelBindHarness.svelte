<script lang="ts">
	// Test-only harness: a host that binds GenerationPanel's read-only checkPending and calls its
	// exported flushChecks(), as a host-owned exit (09-25 memo Print) will.
	import type { ComponentProps } from 'svelte';
	import GenerationPanel from '../GenerationPanel.svelte';
	import type { PanelState } from '../panel-state.svelte';

	let {
		state,
		...rest
	}: { state: PanelState } & Omit<ComponentProps<typeof GenerationPanel>, 'state'> = $props();

	let panel = $state<ReturnType<typeof GenerationPanel> | null>(null);
	let checkPending = $state(false);

	export function flushChecks(): void {
		panel?.flushChecks();
	}
</script>

<GenerationPanel bind:this={panel} bind:checkPending {...rest} {state} />
<output data-testid="pending">{String(checkPending)}</output>
