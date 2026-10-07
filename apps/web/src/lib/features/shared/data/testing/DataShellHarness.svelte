<script lang="ts">
	import type { AlertsDeps, DataRequest, DataRuntime } from '$lib/data';
	import DataShell from '../DataShell.svelte';
	import SpendProbe from './SpendProbe.svelte';

	// Test-only: the (app) layout shape (<main> with DataShell as its content) around a spend probe.
	let {
		runtime,
		showStatusBar = true,
		runAlerts = true,
		alerts,
		request
	}: {
		runtime: DataRuntime;
		showStatusBar?: boolean;
		runAlerts?: boolean;
		alerts?: Partial<AlertsDeps>;
		request: DataRequest;
	} = $props();
</script>

<main id="main-content" tabindex="-1">
	<DataShell {showStatusBar} {runAlerts} {runtime} {alerts}>
		<SpendProbe {request} />
	</DataShell>
</main>
