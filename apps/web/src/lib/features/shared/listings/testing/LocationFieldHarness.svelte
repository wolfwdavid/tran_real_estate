<script lang="ts">
	// Browser-test harness: binds LocationField's value and inputEl the way a search form will.
	import type { LocationError } from '@tran/core/renter/types';
	import LocationField from '../LocationField.svelte';

	let { error = null }: { error?: LocationError | null } = $props();
	let value = $state('');
	let inputEl = $state<HTMLInputElement | undefined>();
</script>

<LocationField bind:value bind:inputEl {error} />
<button type="button" onclick={() => inputEl?.focus()}>Focus field</button>
<output data-value>{value}</output>
