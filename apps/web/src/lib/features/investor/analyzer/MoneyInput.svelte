<script lang="ts">
	// MoneyInput (07-UI-SPEC "Analyzer layout"): a NumericField with the money adornment and hidden unit.
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
	kind="money"
	hiddenUnit=", in dollars"
	prefix="$"
	inputmode="decimal"
/>
