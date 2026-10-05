<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: AlertDialogPrimitive.DescriptionProps = $props();
</script>

<AlertDialogPrimitive.Description
	bind:ref
	data-slot="alert-dialog-description"
	class={cn(
		'text-body text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-primary-hover',
		className
	)}
	{...restProps}
/>
