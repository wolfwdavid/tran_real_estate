<script lang="ts">
	// PercentInput (07-UI-SPEC "Analyzer layout"): a NumericField with the percent adornment and hidden unit.
	import type { ComponentProps } from 'svelte';
	import NumericField from './NumericField.svelte';

	type Props = Omit<
		ComponentProps<typeof NumericField>,
		'kind' | 'hiddenUnit' | 'prefix' | 'suffix' | 'inputmode'
	>;

	let { value = $bindable(), ref = $bindable(null), ...rest }: Props = $props();
</script>

<NumericField
	bind:value
	bind:ref
	{...rest}
	kind="percent"
	hiddenUnit=", in percent"
	suffix="%"
	inputmode="decimal"
/>
