<script lang="ts">
	// The agent portal's sub-navigation (08-UI-SPEC "AgentNav"), rendered once by the agent layout.
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { dueCount = 0 }: { dueCount?: number } = $props();

	const STUDIO_ID = '/(app)/agent/studio';

	// Fixed order. Route ids, not pathnames, decide the current item, so aria-current is already in
	// the prerendered HTML under any base (resolve() is relative while prerendering; the
	// PortalSwitcher / RenterNav pattern). The contact detail belongs to Contacts; the /agent/ home
	// marks no item. Studio (Phase 9) is current on the hub and on every /agent/studio/* tool.
	const links = [
		{ href: resolve('/agent/today/'), label: 'Today', ids: ['/(app)/agent/today'] },
		{ href: resolve('/agent/pipeline/'), label: 'Pipeline', ids: ['/(app)/agent/pipeline'] },
		{
			href: resolve('/agent/contacts/'),
			label: 'Contacts',
			ids: ['/(app)/agent/contacts', '/(app)/agent/contact']
		},
		{ href: resolve('/agent/import/'), label: 'Import', ids: ['/(app)/agent/import'] },
		{ href: resolve('/agent/profile/'), label: 'Profile', ids: ['/(app)/agent/profile'] },
		{ href: resolve('/agent/studio/'), label: 'Studio', ids: [STUDIO_ID], prefix: `${STUDIO_ID}/` }
	];

	const current = ({ ids, prefix }: { ids: string[]; prefix?: string }) => {
		const id = page.route.id;
		if (id === null) return undefined;
		return ids.includes(id) || (prefix !== undefined && id.startsWith(prefix)) ? 'page' : undefined;
	};
	const showCount = $derived(Number.isInteger(dueCount) && dueCount > 0);
	// The link's full name, "Today, 3 tasks due", is an aria-label: a visually hidden span would be
	// position: absolute, which accessible-name computation treats as a block and pads with a space
	// ("Today , 3 tasks due"). The visible text "Today" starts the label, so WCAG 2.5.3 holds.
	const dueLabel = $derived(dueCount === 1 ? 'Today, 1 task due' : `Today, ${dueCount} tasks due`);
</script>

<nav aria-label="Agent tools" class="border-b border-border">
	<ul class="flex flex-wrap items-center gap-x-2 sm:gap-x-4">
		{#each links as l (l.label)}
			<li>
				<a
					href={l.href}
					aria-current={current(l)}
					aria-label={l.label === 'Today' && showCount ? dueLabel : undefined}
					class="inline-flex min-h-11 items-center px-2 text-body text-foreground underline-offset-[6px] hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline aria-[current=page]:decoration-primary aria-[current=page]:decoration-2 sm:px-4"
					>{l.label}{#if l.label === 'Today' && showCount}<span
							class="ml-1 rounded-full bg-accent-surface px-2 text-label font-semibold text-foreground tabular-nums"
							aria-hidden="true">{dueCount}</span
						>{/if}</a
				>
			</li>
		{/each}
	</ul>
</nav>
