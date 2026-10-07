<script lang="ts">
	// UI-SPEC "Contacts list" (/agent/contacts/ once the CRM has contacts): toolbar (search, smart
	// lists, Add a lead, CSV export), then the table at 1024px+ or ContactCards below it, newest
	// first, 50 at a time. Search and the smart list run in memory (no network) and mirror into
	// ?q= and ?list= with replaceState so reload, Back and shared links restore the view. The URL
	// is read once, on mount.
	import Search from '@lucide/svelte/icons/search';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import { onMount, tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Contact, Task } from '@tran/core/agent';
	import {
		SMART_LIST_LABELS,
		countLists,
		matchesList,
		nextOpenTask,
		type ListCtx,
		type SmartList
	} from '@tran/core/crm';
	import { Button, Input, Label, announce } from '$lib/features/shared/data/platform-ui';
	import { useOpenTasks } from '$lib/storage/agent/tasks-live.svelte';
	import { localDateOf, todayLocal } from '../dates';
	import CsvExportButton from '../import/CsvExportButton.svelte';
	import UndoStatus from '../ui/UndoStatus.svelte';
	import ContactCard from './ContactCard.svelte';
	import ContactsTable from './ContactsTable.svelte';
	import SmartListFilter from './SmartListFilter.svelte';
	import { takeFlash } from './flash.svelte';
	import { filterContacts, readListParam, readQueryParam, withParams } from './list-state';

	let {
		contacts,
		onaddlead
	}: {
		/** Live contacts (samples included). */
		contacts: readonly Contact[];
		/** Opens the page's QuickAddDialog. */
		onaddlead: () => void;
	} = $props();

	/** Rows shown before the first Show more contacts. */
	const PAGE = 50;

	const uid = $props.id();
	const searchId = `${uid}-search`;
	const wide = new MediaQuery('min-width: 1024px', false);
	const openTasks = useOpenTasks();
	const today = todayLocal();

	/** The status line's id after a redirect from a deleted contact ("Deleted {Name}."). */
	const FLASH_ID = 'contacts-flash';

	let q = $state('');
	let list = $state<SmartList>('all');
	let limit = $state(PAGE);
	let root = $state<HTMLElement | null>(null);
	let flash = $state<string | null>(null);

	onMount(() => {
		list = readListParam(page.url.search);
		q = readQueryParam(page.url.search);
		// UI-SPEC "Focus management": after Delete contact, focus lands on the result line here.
		flash = takeFlash();
		if (flash) void tick().then(() => document.getElementById(FLASH_ID)?.focus());
	});

	// Grouped into a plain record first; the Map itself is never mutated (it is replaced whenever
	// the open tasks change), so it needs no SvelteMap.
	const openTasksByContact: ReadonlyMap<string, readonly Task[]> = $derived.by(() => {
		const grouped: Record<string, Task[]> = {};
		for (const t of openTasks.current) (grouped[t.contactId] ??= []).push(t);
		return new Map(Object.entries(grouped));
	});
	const ctx: ListCtx = $derived({ today, localDate: localDateOf, openTasksByContact });
	const counts = $derived(countLists(contacts, ctx));
	const rows = $derived(
		filterContacts(contacts, q)
			.filter((c) => matchesList(list, c, ctx))
			.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
	);
	const shown = $derived(rows.slice(0, limit));
	const caption = $derived(`${rows.length} ${rows.length === 1 ? 'contact' : 'contacts'}`);
	const nextTask = (c: Contact): Task | null => nextOpenTask(openTasksByContact.get(c.id) ?? []);

	function syncUrl() {
		limit = PAGE;
		const href = resolve('/agent/contacts/') + withParams(page.url.search, { list, q });
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- href is resolve() plus this page's own query string
		replaceState(href, page.state);
	}

	function onListChange(next: SmartList) {
		syncUrl();
		announce(`Showing ${SMART_LIST_LABELS[next]}: ${caption}.`);
	}

	function clearSearch() {
		q = '';
		syncUrl();
		document.getElementById(searchId)?.focus();
	}

	function showAll() {
		list = 'all';
		onListChange('all');
	}

	/**
	 * Moves focus to a contact's name link when it is rendered under the current filter and page.
	 * Returns false when it is not (the caller falls back to the page h1).
	 */
	export async function focusContact(id: string): Promise<boolean> {
		await tick();
		const link = document.getElementById(`contact-${id}-name`);
		if (!link || !root?.contains(link)) return false;
		link.focus();
		return true;
	}
</script>

<div bind:this={root} class="mt-6 flex flex-col gap-6" data-contacts-view>
	<UndoStatus id={FLASH_ID} message={flash} />
	<div class="flex flex-col gap-4">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="relative w-full max-w-md">
				<Label for={searchId} class="sr-only">Search contacts</Label>
				<Search
					size={16}
					aria-hidden="true"
					class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					id={searchId}
					type="search"
					value={q}
					oninput={(e) => {
						q = e.currentTarget.value;
						syncUrl();
					}}
					placeholder="Name, email, or phone"
					autocomplete="off"
					class="pl-11"
				/>
			</div>
			<div class="flex flex-wrap items-start gap-2">
				<Button variant="outline" class="min-h-11" onclick={onaddlead}>
					<UserPlus size={16} aria-hidden="true" />
					Add a lead
				</Button>
				<CsvExportButton />
			</div>
		</div>
		<SmartListFilter bind:value={list} {counts} onchange={onListChange} />
	</div>

	{#if rows.length === 0 && q.trim() !== ''}
		<div class="flex flex-col items-start gap-2" data-contacts-no-match>
			<p class="text-base leading-[1.6] text-foreground">No contacts match "{q}".</p>
			<Button variant="ghost" class="min-h-11" onclick={clearSearch}>Clear search</Button>
		</div>
	{:else if rows.length === 0 && list !== 'all'}
		<div class="flex flex-col items-start gap-2" data-contacts-no-match>
			<p class="text-base leading-[1.6] text-foreground">
				No contacts match {SMART_LIST_LABELS[list]} right now.
			</p>
			<Button variant="ghost" class="min-h-11" onclick={showAll}>Show all contacts</Button>
		</div>
	{:else if wide.current}
		<ContactsTable rows={shown} {caption} {today} {nextTask} />
	{:else}
		<div class="flex flex-col gap-3">
			<p class="text-label text-muted-foreground" data-contacts-caption>{caption}</p>
			<ul class="flex flex-col gap-3" aria-label={caption}>
				{#each shown as c (c.id)}
					<li><ContactCard contact={c} nextTask={nextTask(c)} {today} variant="list" /></li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if rows.length > shown.length}
		<Button variant="outline" class="min-h-11 self-start" onclick={() => (limit += PAGE)}>
			Show more contacts
		</Button>
	{/if}
</div>
