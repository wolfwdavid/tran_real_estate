<script lang="ts">
	// "Save this search" (RENT-04, UI-SPEC "/renter/ (Search) layout" item 2). Saving writes storage
	// only (0 calls): the Phase 4 saved search with a baseline snapshot of these results, plus the
	// renter filters. When this location + filter set is already saved, the button reads
	// "Saved search" (aria-pressed) and it and "Manage in Saved searches" move focus to that row.
	import { tick } from 'svelte';
	import BookmarkCheck from '@lucide/svelte/icons/bookmark-check';
	import BookmarkPlus from '@lucide/svelte/icons/bookmark-plus';
	import { getDataRuntime } from '$lib/data';
	import { defaultSearchName } from '@tran/core/renter';
	import { Button, announce } from '$lib/features/shared/data/platform-ui';
	import { live } from '$lib/storage/live.svelte';
	import { requestPersistence } from '$lib/storage/persistence';
	import type { RenterSearch } from '../search/search-state.svelte';
	import SaveSearchDialog from './SaveSearchDialog.svelte';
	import {
		getRenterSavedSearches,
		matchesSearch,
		type RenterSavedSearch,
		type RenterSavedSearches
	} from './saved-searches';
	import { focusSavedSearch } from './focus';

	let { search }: { search: RenterSearch } = $props();

	const runtime = getDataRuntime();
	let service: RenterSavedSearches | null = null;
	const svc = () => (service ??= getRenterSavedSearches(() => runtime.gateway));

	// Re-created when the gateway changes (the cached rows behind the counts come from it).
	const saved = $derived.by(() => {
		void runtime.gateway;
		return live<RenterSavedSearch[]>(() => svc().listRenter(), []);
	});

	const match = $derived(
		search.location
			? saved.current.find((s) => matchesSearch(s, search.location!, search.filters))
			: undefined
	);

	let open = $state(false);
	let mode = $state<'save' | 'limit'>('save');
	let justSaved = false;
	let savedButton = $state<HTMLElement | null>(null);

	const initialName = $derived(defaultSearchName(search.locationText, search.filters));

	/** The limit counts every renter saved search in storage (the source of truth at click time). */
	async function openDialog() {
		mode = (await svc().canSave()) ? 'save' : 'limit';
		open = true;
	}

	async function save(name: string): Promise<boolean> {
		const location = search.location;
		if (!location) return false;
		const res = await svc().save({
			name,
			location,
			filters: $state.snapshot(search.filters),
			sort: search.sort,
			rows: search.rows,
			provenance: search.provenance,
			truncated: search.truncated
		});
		if ('error' in res) {
			// Another tab filled the last slot: explain the limit instead of saving.
			if (res.error === 'limit') mode = 'limit';
			return false;
		}
		justSaved = true;
		void requestPersistence().catch(() => undefined);
		announce(`Search saved: ${res.name}.`);
		return true;
	}

	async function afterClose(e: Event) {
		if (!justSaved) return;
		justSaved = false;
		e.preventDefault();
		await tick();
		savedButton?.focus();
	}
</script>

{#if search.location && search.rows.length > 0}
	{#if match}
		<div class="flex flex-col items-start gap-1 sm:items-end">
			<Button
				bind:ref={savedButton}
				variant="outline"
				class="min-h-11"
				aria-pressed="true"
				onclick={() => focusSavedSearch(match.id)}
			>
				<BookmarkCheck class="size-4" aria-hidden="true" />
				Saved search
			</Button>
			<a
				href={`#saved-search-${match.id}`}
				class="text-label text-foreground underline underline-offset-4 hover:no-underline"
				onclick={(e) => {
					e.preventDefault();
					focusSavedSearch(match.id);
				}}>Manage in Saved searches</a
			>
		</div>
	{:else}
		<Button variant="outline" class="min-h-11" onclick={openDialog}>
			<BookmarkPlus class="size-4" aria-hidden="true" />
			Save this search
		</Button>
	{/if}
	<SaveSearchDialog bind:open {mode} {initialName} onSubmit={save} onCloseAutoFocus={afterClose} />
{/if}
