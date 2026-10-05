<script lang="ts">
	import { availableSections } from './sections';

	const sections = availableSections();
</script>

<!-- In-page section links. No scroll-spy. Stacks under the lead below 1024px. -->
<nav aria-label="Settings sections" class="mb-12 lg:mb-0">
	<p class="text-label font-semibold text-secondary uppercase">On this page</p>
	<ul class="mt-2">
		{#each sections as section (section.id)}
			<li>
				<a
					href="#{section.id}"
					class="flex min-h-11 items-center text-body text-foreground underline-offset-3 hover:underline"
				>
					{section.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
