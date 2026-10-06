<script lang="ts">
	// Test-only: provides a data runtime through context (as the (app) layout does) around the
	// fair-rent card.
	import type { Listing } from '@tran/core/listings';
	import { setDataRuntime, type DataRuntime, type Provenance } from '$lib/data';
	import FairRentCheck from '../FairRentCheck.svelte';

	let { runtime, row, provenance }: { runtime: DataRuntime; row: Listing; provenance: Provenance } =
		$props();

	// svelte-ignore state_referenced_locally
	setDataRuntime(runtime);
</script>

<main>
	<FairRentCheck {row} {provenance} />
</main>
