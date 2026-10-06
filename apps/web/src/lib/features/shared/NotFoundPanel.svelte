<script lang="ts">
	// The neutral not-found panel (07-UI-SPEC Component Inventory "NotFoundPanel"): a missing or
	// unknown `?id=`, `?ids=` or `?zip=` renders this in the page, never a 404 (the route exists).
	// `href` is already resolved by the caller (resolve() from $app/paths).
	import SearchX from '@lucide/svelte/icons/search-x';

	let {
		title,
		body,
		href,
		linkLabel,
		headingLevel = 2
	}: {
		title: string;
		body: string;
		href: string;
		linkLabel: string;
		headingLevel?: 2 | 3 | 4;
	} = $props();
</script>

<div class="flex gap-3 rounded-md bg-surface p-4" data-not-found-panel>
	<SearchX class="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
	<div>
		<svelte:element
			this={`h${headingLevel}`}
			class="text-base leading-[1.6] font-semibold text-foreground">{title}</svelte:element
		>
		<p class="mt-1 text-base leading-[1.6] text-foreground">{body}</p>
		<p class="mt-2">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve() output -->
			<a
				{href}
				class="inline-flex min-h-11 items-center text-base leading-[1.6] font-semibold text-foreground underline underline-offset-4 hover:decoration-2"
				>{linkLabel}</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</p>
	</div>
</div>
