<script lang="ts">
	import { getDataRuntime, type DataRequest } from '$lib/data';

	// Test-only stand-in for a portal page: one click handler that spends through the runtime the
	// (app) layout's DataShell provides. Records how the spend settled.
	let { request }: { request: DataRequest } = $props();

	const runtime = getDataRuntime();
	let outcome = $state('');

	async function spend(): Promise<void> {
		try {
			await runtime.requestSpend(request);
			outcome = 'spent';
		} catch (e) {
			outcome = `error:${(e as { detail?: string }).detail ?? ''}`;
		}
	}
</script>

<h1>Portal</h1>
<button type="button" onclick={spend}>Search rentals</button>
<p data-testid="outcome">{outcome}</p>
