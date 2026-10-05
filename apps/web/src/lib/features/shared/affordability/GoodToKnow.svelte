<script lang="ts">
	// 06-UI-SPEC "Good to know" callout (Phase 3 HonestyCallout pattern). Static copy only.
	import Info from '@lucide/svelte/icons/info';

	const POINTS = [
		'This is a general guideline based on common rules of thumb, not financial advice.',
		"Utilities, transport, childcare, and insurance aren't included, and they can change what's comfortable for you.",
		'Landlords set their own income and credit requirements. Ask the listing contact what they look for.'
	] as const;
</script>

<aside
	aria-labelledby="afford-good-to-know"
	class="flex gap-3 rounded-lg border-l-4 border-secondary bg-secondary-surface p-4 sm:p-6"
>
	<Info class="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden="true" />
	<div class="grid gap-2">
		<h3 id="afford-good-to-know" class="text-base leading-[1.6] font-semibold text-foreground">
			Good to know
		</h3>
		<ul class="grid list-disc gap-2 pl-5 text-base leading-[1.6] text-foreground">
			{#each POINTS as point (point)}
				<li>{point}</li>
			{/each}
		</ul>
	</div>
</aside>
