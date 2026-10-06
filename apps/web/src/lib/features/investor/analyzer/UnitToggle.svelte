<script lang="ts" generics="T extends string">
	// UnitToggle (07-UI-SPEC "ExpenseLines" unit toggle): a segmented pair of NATIVE radios inside a
	// fieldset with a visually hidden legend, so arrow keys and screen readers work with no script.
	// Each radio covers its segment (06-13 FilterFields precedent). The selected segment shows a
	// Check icon and weight 600, so state is never carried by color alone.
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		name: string;
		legend: string;
		options: ReadonlyArray<{ value: T; label: string }>;
		value: T;
		/** Called after the selection changes, with the new and previous values. */
		onchange?: (next: T, previous: T) => void;
	}

	let { name, legend, options, value = $bindable(), onchange }: Props = $props();

	function select(next: T) {
		const previous = value;
		if (next === previous) return;
		value = next;
		onchange?.(next, previous);
	}

	const HIDDEN_INPUT = 'absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0';
</script>

<fieldset class="m-0 min-w-0 border-0 p-0">
	<legend class="sr-only">{legend}</legend>
	<div class="inline-flex">
		{#each options as option, i (option.value)}
			{@const selected = option.value === value}
			<label
				class="relative inline-flex min-h-11 min-w-24 cursor-pointer touch-manipulation items-center justify-center gap-1 border border-input px-3 text-base leading-[1.6] has-[input:focus-visible]:z-10 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring {i ===
				0
					? 'rounded-l-md'
					: '-ml-px'} {i === options.length - 1 ? 'rounded-r-md' : ''} {selected
					? 'bg-foreground font-semibold text-card'
					: 'bg-transparent font-normal text-foreground hover:bg-surface'}"
				><input
					type="radio"
					{name}
					value={option.value}
					checked={selected}
					onchange={() => select(option.value)}
					class={HIDDEN_INPUT}
				/>{#if selected}<Check
						class="size-4 shrink-0"
						aria-hidden="true"
					/>{/if}{option.label}</label
			>
		{/each}
	</div>
</fieldset>
