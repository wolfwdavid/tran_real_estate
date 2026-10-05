<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export const buttonVariants = tv({
		base: 'inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-1 rounded-md text-body font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-surface disabled:text-muted-foreground aria-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0',
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
				outline: 'border border-border-strong bg-transparent text-foreground hover:bg-surface',
				ghost: 'bg-transparent text-foreground hover:bg-surface',
				destructive:
					'bg-destructive text-destructive-foreground underline-offset-3 hover:underline',
				'destructive-outline':
					'border border-destructive bg-transparent text-destructive hover:bg-accent-surface',
				link: 'h-auto px-0 text-primary underline underline-offset-3 hover:text-primary-hover hover:decoration-2'
			},
			size: {
				default: 'h-12 min-w-11 px-6',
				icon: 'size-11'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
	};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

<button
	bind:this={ref}
	data-slot="button"
	class={cn(buttonVariants({ variant, size }), className)}
	{type}
	{disabled}
	{...restProps}
>
	{@render children?.()}
</button>
