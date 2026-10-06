<script lang="ts">
	// The agent portal's sub-navigation (08-UI-SPEC "AgentNav"), rendered once by the agent layout.
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { dueCount = 0 }: { dueCount?: number } = $props();

	// Fixed order. Route ids, not pathnames, decide the current item, so aria-current is already in
	// the prerendered HTML under any base (resolve() is relative while prerendering; the
	// PortalSwitcher / RenterNav pattern). The contact detail belongs to Contacts; the /agent/ home
	// marks no item. Phase 9 appends Studio.
	const links = [
		{ href: resolve('/agent/today/'), label: 'Today', ids: ['/(app)/agent/today'] },
		{ href: resolve('/agent/pipeline/'), label: 'Pipeline', ids: ['/(app)/agent/pipeline'] },
		{
			href: resolve('/agent/contacts/'),
			label: 'Contacts',
			ids: ['/(app)/agent/contacts', '/(app)/agent/contact']
		},
		{ href: resolve('/agent/import/'), label: 'Import', ids: ['/(app)/agent/import'] },
		{ href: resolve('/agent/profile/'), label: 'Profile', ids: ['/(app)/agent/profile'] }
	];

	const current = (ids: string[]) =>
		page.route.id !== null && ids.includes(page.route.id) ? 'page' : undefined;
	const showCount = $derived(Number.isInteger(dueCount) && dueCount > 0);
	// Completes the link name: "Today, 3 tasks due". A variable, because Svelte trims leading
	// whitespace in literal element text.
	const dueSuffix = $derived(dueCount === 1 ? ', 1 task due' : `, ${dueCount} tasks due`);
</script>

<nav aria-label="Agent tools" class="border-b border-border">
	<ul class="flex flex-wrap items-center gap-x-2 sm:gap-x-4">
		{#each links as l (l.label)}
			<li>
				<a
					href={l.href}
					aria-current={current(l.ids)}
					class="inline-flex min-h-11 items-center px-2 text-body text-foreground underline-offset-[6px] hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline aria-[current=page]:decoration-primary aria-[current=page]:decoration-2 sm:px-4"
					>{l.label}{#if l.label === 'Today' && showCount}<span
							class="ml-1 rounded-full bg-accent-surface px-2 text-label font-semibold text-foreground tabular-nums"
							aria-hidden="true">{dueCount}</span
						><span class="sr-only">{dueSuffix}</span>{/if}</a
				>
			</li>
		{/each}
	</ul>
</nav>
