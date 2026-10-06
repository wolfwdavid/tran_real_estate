<script lang="ts">
	// NumberInput (07-UI-SPEC "Analyzer layout"): plain numbers (bedrooms, bathrooms, square feet,
	// loan term). `integer` switches to the numeric keyboard; an optional suffix ("years") is an
	// aria-hidden adornment and the label carries ", in {suffix}" as visually hidden text.
	import type { ComponentProps } from 'svelte';
	import NumericField from './NumericField.svelte';

	type Props = Omit<
		ComponentProps<typeof NumericField>,
		'kind' | 'hiddenUnit' | 'prefix' | 'suffix' | 'inputmode'
	> & { suffix?: string; integer?: boolean };

	let {
		value = $bindable(),
		ref = $bindable(null),
		suffix,
		integer = false,
		...rest
	}: Props = $props();
</script>

<NumericField
	bind:value
	bind:ref
	{...rest}
	kind="number"
	{suffix}
	hiddenUnit={suffix ? `, in ${suffix}` : ''}
	inputmode={integer ? 'numeric' : 'decimal'}
/>
