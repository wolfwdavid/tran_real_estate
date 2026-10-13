<script lang="ts">
	// Result-state headline: label (Body 600), value (Fraunces Heading, lining tabular), definition.
	interface Props {
		label: string;
		value: string;
		definition: string;
	}

	let { label, value, definition }: Props = $props();
</script>

<p class="text-body font-semibold text-foreground">{label}</p>
<p
	class="font-display text-heading font-semibold text-foreground tabular-nums [font-variant-numeric:lining-nums_tabular-nums]"
>
	{value}
</p>
<p class="text-label text-muted-foreground">{definition}</p>
