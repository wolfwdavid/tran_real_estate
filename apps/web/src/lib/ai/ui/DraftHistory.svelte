<script lang="ts" module>
	import type { AiArtifact } from '$lib/ai/storage/artifacts';
	import { PROVIDER_LABELS } from '$lib/ai/models';

	export const PAGE_SIZE = 10;
	const PREVIEW_CHARS = 120;

	const sameDay = (a: Date, b: Date) =>
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate();

	// ICU puts a narrow no-break space before AM/PM; plain spaces keep the copy predictable.
	const SPACES = new RegExp(`[${String.fromCharCode(0x202f, 0xa0)}]`, 'g');
	const plain = (s: string) => s.replace(SPACES, ' ');

	/** "Today at 3:42 PM" for the same local day as `now`, else "Oct 2 at 9:10 AM". */
	export function formatWhen(iso: string, now: Date = new Date()): string {
		const at = new Date(iso);
		const time = plain(
			new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(at)
		);
		if (sameDay(at, now)) return `Today at ${time}`;
		const day = plain(
			new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(at)
		);
		return `${day} at ${time}`;
	}

	/** The first 120 characters, with "…" when the text is longer. */
	export function preview(text: string): string {
		return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
	}

	/** "{Provider} · {model}", or "Sample output" for the keyless sample provider. */
	export function sourceLine(a: Pick<AiArtifact, 'sample' | 'provider' | 'model'>): string {
		if (a.sample || a.provider === 'fixture') return 'Sample output';
		return `${PROVIDER_LABELS[a.provider]} · ${a.model}`;
	}

	/** "{n} Fair Housing flags when generated" (singular for one). */
	export function flagsLine(n: number): string {
		return n === 1
			? '1 Fair Housing flag when generated'
			: `${n} Fair Housing flags when generated`;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import ConfirmDialog from '$lib/features/shared/settings/ConfirmDialog.svelte';
	import type { ArtifactRepo } from '$lib/ai/storage/artifacts';
	import ArtifactStatusBadge from './ArtifactStatusBadge.svelte';

	// Stored drafts for one feature (05-UI-SPEC DraftHistory anatomy). Rows load in the browser
	// (newest first, ten at a time); `initial` stands in for that load in SSR tests and prerender.
	// Open hands the artifact to the panel, which re-runs the Fair Housing checker: stored findings
	// are shown only as a count and are never trusted on reopen.

	interface Props {
		feature: string;
		repo: ArtifactRepo;
		headingLevel: 3 | 4;
		onOpen: (a: AiArtifact) => void;
		/** Bump to reload (e.g. after the panel saves a new draft). */
		refreshKey?: number;
		initial?: { artifacts: AiArtifact[]; count: number };
	}

	let { feature, repo, headingLevel, onOpen, refreshKey = 0, initial }: Props = $props();

	const uid = $props.id();
	const LEGEND =
		"Reviewed means it passed the Fair Housing check and you copied it or opened it in your email app. Marked as sent is your own note; Tran doesn't send or track email.";
	const EMPTY =
		'No drafts yet. Each draft you generate here is saved in this browser and included in your backups.';
	const DELETE_BODY =
		"This removes the draft from Draft history in this browser. It can't be undone. Anything you already copied or emailed isn't affected.";

	let artifacts = $state<AiArtifact[]>(untrack(() => initial?.artifacts ?? []));
	let total = $state(untrack(() => initial?.count ?? 0));
	let loaded = $state(untrack(() => initial !== undefined));
	let failed = $state(false);
	let loadingMore = $state(false);
	let titleEl = $state<HTMLElement | null>(null);
	let justDeleted = false;
	const openRefs: Record<string, HTMLElement | null> = $state({});

	const now = new Date();

	async function load(limit: number): Promise<void> {
		try {
			const [rows, n] = await Promise.all([
				repo.listByFeature(feature, { limit, offset: 0 }),
				repo.countByFeature(feature)
			]);
			artifacts = rows;
			total = n;
			failed = false;
		} catch {
			failed = true;
		} finally {
			loaded = true;
		}
	}

	// Browser only: load on mount, and again whenever the feature or refreshKey changes.
	$effect(() => {
		void feature;
		void refreshKey;
		void load(
			Math.max(
				PAGE_SIZE,
				untrack(() => artifacts.length)
			)
		);
	});

	async function showOlder(): Promise<void> {
		if (loadingMore) return;
		loadingMore = true;
		try {
			const older = await repo.listByFeature(feature, {
				limit: PAGE_SIZE,
				offset: artifacts.length
			});
			const seen = new Set(artifacts.map((a) => a.id));
			artifacts = [...artifacts, ...older.filter((a) => !seen.has(a.id))];
		} catch {
			failed = true;
		} finally {
			loadingMore = false;
		}
	}

	async function markNotSent(a: AiArtifact): Promise<void> {
		const at = new Date();
		await repo.setStatus(a.id, 'acknowledged', at);
		artifacts = artifacts.map((x) =>
			x.id === a.id
				? { ...x, status: 'acknowledged', sentAt: null, updatedAt: at.toISOString() }
				: x
		);
		announce('Marked as not sent in Draft history.');
		// The button just pressed is gone; keep focus in the same row.
		openRefs[a.id]?.focus();
	}

	async function remove(a: AiArtifact): Promise<void> {
		await repo.softDelete(a.id, new Date());
		justDeleted = true;
	}

	function afterDialogClose(e: Event): void {
		if (!justDeleted) return;
		justDeleted = false;
		e.preventDefault();
		titleEl?.focus();
		announce('Draft deleted.');
		void load(Math.max(PAGE_SIZE, artifacts.length - 1));
	}
</script>

<section aria-labelledby="{uid}-title" class="grid gap-4">
	<div class="grid gap-1">
		<svelte:element
			this={`h${headingLevel}`}
			id="{uid}-title"
			bind:this={titleEl}
			tabindex="-1"
			class="text-base leading-[1.6] font-semibold text-foreground"
		>
			Draft history
		</svelte:element>
		{#if loaded && !failed}
			<p class="text-label text-muted-foreground">{total} saved in this browser</p>
		{/if}
		<p class="text-label text-muted-foreground">{LEGEND}</p>
	</div>

	{#if !loaded}
		<p class="text-label text-muted-foreground">Checking this browser…</p>
	{:else if failed && artifacts.length === 0}
		<p class="text-base leading-[1.6] text-foreground">
			Couldn't read Draft history in this browser. Reload the page to try again.
		</p>
	{:else if artifacts.length === 0}
		<p class="text-base leading-[1.6] text-muted-foreground">{EMPTY}</p>
	{:else}
		<ul class="grid gap-4">
			{#each artifacts as a (a.id)}
				<li class="grid gap-2 rounded-lg border border-border bg-card p-4">
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
						<ArtifactStatusBadge status={a.status} />
						<span id="{uid}-{a.id}-when" class="text-label text-muted-foreground"
							>{formatWhen(a.createdAt, now)}</span
						>
						<span class="text-label [overflow-wrap:anywhere] text-muted-foreground"
							>{sourceLine(a)}</span
						>
					</div>
					<p class="text-base leading-[1.6] [overflow-wrap:anywhere] text-foreground">
						{preview(a.text)}
					</p>
					{#if a.findings.length > 0}
						<p class="text-label text-muted-foreground">{flagsLine(a.findings.length)}</p>
					{/if}
					<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
						<Button
							variant="outline"
							bind:ref={openRefs[a.id]}
							aria-describedby="{uid}-{a.id}-when"
							onclick={() => onOpen(a)}>Open</Button
						>
						{#if a.status === 'sent'}
							<Button
								variant="ghost"
								aria-describedby="{uid}-{a.id}-when"
								onclick={() => void markNotSent(a)}>Mark as not sent</Button
							>
						{/if}
						<ConfirmDialog
							title="Delete this draft?"
							body={[DELETE_BODY]}
							confirmLabel="Delete draft"
							confirmBusyLabel="Deleting…"
							cancelLabel="Keep draft"
							onConfirm={() => remove(a)}
							onError={() => announce("Couldn't delete this draft. Try again.")}
							onCloseAutoFocus={afterDialogClose}
						>
							{#snippet trigger({ props })}
								<Button
									{...props}
									variant="destructive-outline"
									aria-describedby="{uid}-{a.id}-when">Delete</Button
								>
							{/snippet}
						</ConfirmDialog>
					</div>
				</li>
			{/each}
		</ul>
		{#if artifacts.length < total}
			<Button
				variant="outline"
				class="self-start"
				aria-disabled={loadingMore}
				onclick={() => void showOlder()}>Show older drafts</Button
			>
		{/if}
	{/if}
</section>
