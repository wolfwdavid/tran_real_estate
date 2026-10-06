<script lang="ts">
	// "Saved searches" (RENT-04) above the search form. Rows come from a Dexie liveQuery, so a
	// save, rename, delete or the on-open scheduler pass (Phase 4 DataShell) shows up at once. The
	// counts are "new since your last visit" filtered by each search's own filters. Storage only:
	// nothing here spends; View results restores from the cache on /renter/?saved={id}.
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { getDataRuntime } from '$lib/data';
	import { announce } from '$lib/features/shared/data/platform-ui';
	import SavedSearchRow from '$lib/features/shared/listings/SavedSearchRow.svelte';
	import { live } from '$lib/storage/live.svelte';
	import type { RenterSearch } from '../search/search-state.svelte';
	import SaveSearchDialog from './SaveSearchDialog.svelte';
	import { savedSearchHeadingId } from './focus';
	import {
		getRenterSavedSearches,
		type RenterSavedSearch,
		type RenterSavedSearches
	} from './saved-searches';

	let { search }: { search: RenterSearch } = $props();

	const runtime = getDataRuntime();
	let service: RenterSavedSearches | null = null;
	const svc = () => (service ??= getRenterSavedSearches(() => runtime.gateway));

	const saved = $derived.by(() => {
		void runtime.gateway;
		return live<RenterSavedSearch[]>(() => svc().listRenter(), []);
	});

	const source = $derived(runtime.mode?.source === 'sample' ? 'sample' : 'rentcast');
	const atCap = $derived(runtime.usage?.state === 'at' || runtime.usage?.state === 'past');

	let headingEl = $state<HTMLElement | null>(null);
	let renameOpen = $state(false);
	let renaming = $state<RenterSavedSearch | null>(null);

	function viewHref(s: RenterSavedSearch): string {
		const saved = `saved=${encodeURIComponent(s.id)}`;
		return `${resolve('/renter/')}?${s.query ? `${s.query}&` : ''}${saved}`;
	}

	function startRename(s: RenterSavedSearch) {
		renaming = s;
		renameOpen = true;
	}

	async function rename(name: string): Promise<boolean> {
		if (!renaming) return false;
		const res = await svc().rename(renaming.id, name);
		if ('error' in res) return false;
		announce(`Search renamed to ${res.name}.`);
		return true;
	}

	async function remove(id: string) {
		await svc().remove(id);
		announce('Saved search deleted.');
	}

	async function focusHeading(e: Event) {
		e.preventDefault();
		await tick();
		headingEl?.focus();
	}
</script>

{#if saved.current.length > 0}
	<section aria-labelledby="saved-searches-heading" class="flex flex-col gap-4">
		<h2
			id="saved-searches-heading"
			bind:this={headingEl}
			tabindex="-1"
			class="font-display text-heading font-semibold text-foreground focus:outline-none"
		>
			Saved searches
		</h2>
		<ul class="grid grid-cols-1 gap-4 md:grid-cols-2">
			{#each saved.current as s (s.id)}
				<li>
					<SavedSearchRow
						headingId={savedSearchHeadingId(s.id)}
						name={s.name}
						summary={s.summary}
						newCount={s.newCount}
						checkedAt={s.checkedAt}
						{source}
						waiting={source === 'rentcast' && s.due && atCap}
						href={viewHref(s)}
						onRename={() => startRename(s)}
						onDelete={() => remove(s.id)}
						onDeleteCloseAutoFocus={focusHeading}
					/>
				</li>
			{/each}
		</ul>
		<SaveSearchDialog
			bind:open={renameOpen}
			mode="rename"
			initialName={renaming?.name ?? ''}
			onSubmit={rename}
		/>
	</section>
{:else if search.rows.length > 0}
	<p class="text-base leading-[1.6] text-muted-foreground">
		Save this search to see what's new each time you come back.
	</p>
{/if}
