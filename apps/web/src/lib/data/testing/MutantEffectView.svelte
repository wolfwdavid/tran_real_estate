<!--
	Test-only, DELIBERATELY WRONG view: it spends a RentCast call inside $effect, the exact pattern the
	lint rule (layer 1) and the runtime reactive guard (layer 2) forbid. rerender.browser.test.ts uses it
	to prove the 10-re-render call-count test is non-vacuous. Lives under lib/data/testing so it never
	ships. gateway.get is async (the guard throws inside it before its first await), so the guard
	surfaces as a rejected promise, not a synchronous throw: the rejection sets `blocked`.
-->
<script lang="ts">
	import type { DataRequest } from '@tran/core/request';
	import { ReactiveSpendError } from '../gateway';
	import type { DataRuntime } from '../runtime.svelte';

	let { runtime, request, tick }: { runtime: DataRuntime; request: DataRequest; tick: number } =
		$props();

	let blocked = $state(false);

	$effect(() => {
		void tick;
		const gateway = runtime.gateway;
		// eslint-disable-next-line no-restricted-syntax -- deliberate mutant: proves the reactive guard and the re-render test catch a spend in $effect
		gateway?.get(request).catch((e: unknown) => {
			if (e instanceof ReactiveSpendError) blocked = true;
		});
	});
</script>

<p data-testid="blocked">{blocked}</p>
