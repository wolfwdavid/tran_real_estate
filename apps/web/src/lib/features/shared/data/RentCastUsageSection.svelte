<script lang="ts">
	import { untrack } from 'svelte';
	import { getDataRuntime, type DataRuntime } from '$lib/data';
	import CallMeter from './CallMeter.svelte';
	import CapEditor from './CapEditor.svelte';
	import DataSourceChoice from './DataSourceChoice.svelte';
	import type { DataSource } from './copy/source';

	// Settings slot 2, "RentCast usage" (04-UI-SPEC "Settings additions"; DATA-02, DATA-03): the
	// full meter, the cap editor and the data source choice, all against the app data runtime that
	// DataShell provides and starts. Saving the cap and switching the source go through the runtime,
	// which persists, updates every meter at once and broadcasts to other tabs.
	// The prerendered shell shows the static copy plus "Checking this browser…" where the meter goes.

	let { runtime: injected }: { runtime?: DataRuntime } = $props();

	const runtime = untrack(() => injected) ?? getDataRuntime();

	const usage = $derived(runtime.usage);
	const mode = $derived(runtime.mode);

	const keyState = $derived.by((): 'none' | 'locked' | 'available' => {
		switch (mode?.reason) {
			case 'no-key':
				return 'none';
			case 'locked':
				return 'locked';
			default:
				return 'available';
		}
	});
	const source = $derived<DataSource>(mode?.reason === 'chosen' ? 'sample' : 'rentcast');

	// A cap saved in another tab remounts the editor so its input shows the new value. A local save
	// keeps the editor (and its "Cap saved" line) as is.
	let capEpoch = $state(0);
	$effect(() => {
		if (runtime.lastRemoteChange?.type === 'cap-changed') {
			untrack(() => capEpoch++);
		}
	});

	const saveCap = (cap: number) => runtime.saveCap(cap);
	const setSource = (v: DataSource) => runtime.setSourcePreference(v);
</script>

<section id="rentcast-usage" aria-labelledby="rentcast-usage-heading">
	<h2 id="rentcast-usage-heading" tabindex="-1" class="font-display text-heading font-semibold">
		RentCast usage
	</h2>
	<p class="mt-4 text-body">
		Tran counts every RentCast call made from this browser and stops before your cap, so a busy
		week can't use up your free calls. Results are saved in this browser and reused, so repeating a
		search costs nothing.
	</p>

	<div class="mt-8 space-y-8">
		<div>
			<h3 class="text-body font-semibold">This month</h3>
			<div class="mt-4">
				{#if usage}
					<CallMeter
						id="rentcast-usage-meter"
						variant="full"
						used={usage.countedTowardCap}
						unbilled={usage.noResults}
						cap={usage.cap}
						resetsAt={usage.resetsAt}
					/>
				{:else}
					<p class="text-label text-muted-foreground">Checking this browser…</p>
				{/if}
			</div>
		</div>

		<div>
			<h3 class="text-body font-semibold">Monthly call cap</h3>
			{#if usage}
				<div class="mt-4">
					{#key capEpoch}
						<CapEditor cap={usage.cap} used={usage.countedTowardCap} onSave={saveCap} />
					{/key}
				</div>
			{/if}
		</div>

		<div>
			<h3 class="text-body font-semibold">Data source</h3>
			{#if mode}
				<div class="mt-4">
					<DataSourceChoice {keyState} value={source} onChange={setSource} />
				</div>
			{/if}
		</div>
	</div>
</section>
