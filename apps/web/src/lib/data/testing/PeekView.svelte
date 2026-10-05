<!--
	Test-only harness. The sanctioned pattern: views read with createPeekStore/peek, never get/refresh.
	Used by rerender.browser.test.ts to prove that re-rendering a gateway-backed view spends 0 calls.
-->
<script lang="ts">
	import type { DataRequest } from '@tran/core/request';
	import type { DataRuntime } from '../runtime.svelte';
	import { createPeekStore } from '../stores.svelte';

	let { runtime, request, tick }: { runtime: DataRuntime; request: DataRequest; tick: number } =
		$props();

	// The runtime is fixed for the view's lifetime (real views take it once via getDataRuntime()).
	// svelte-ignore state_referenced_locally
	const view = createPeekStore(runtime, () => request);
</script>

<p data-testid="tick">{tick}</p>
{#if view.current?.kind === 'data'}
	<p data-testid="rows">{(view.current.result.data as unknown[]).length}</p>
{:else}
	<p data-testid="rows">none</p>
{/if}
