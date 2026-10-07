<script module lang="ts">
	import type { SectionSpec as PlatformSectionSpec } from './PlatformCard.svelte';

	/** One platform section of a `sections` run (09-19); hosts build these (09-20 social). */
	export type SectionSpec = PlatformSectionSpec;
</script>

<script lang="ts">
	// 05-UI-SPEC "GenerationPanel": the one panel every generator in Phases 6-9 uses. A thin view
	// over PanelState (panel-state.svelte.ts), where every rule lives and is unit-tested.
	//
	// AI-04: the exits group holds exactly three human-initiated controls (Copy text, Open in email
	// app, Mark as sent) and they reach exits.ts only through PanelState. Nothing else in this
	// panel moves text out of the browser. Gated exits keep focus (aria-disabled, never `disabled`)
	// and the email link loses its href while gated.
	//
	// Cross-phase props (coordinator contract): postChecks, tokens, emailFooter, exitDisabled,
	// formatForExit (Phase 9), onExit, subjectId and beforeGenerate (Phase 6), checkGroups and artifactMeta (Phase 7), and the
	// read-only bindables canExit / blocked / findings / artifactId / draftText.
	//
	// Phase 9 `sections` mode (09-UI-SPEC PlatformCard): the output box, findings summary, email
	// footer and the three-exit group are replaced by one PlatformCard per section, each with
	// exactly one Copy exit. Without `sections` the panel renders exactly as before. `state` is the test/SSR seam
	// and the Draft history wiring; when absent the panel builds its own PanelState with live deps.
	import { onMount, tick } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Copy from '@lucide/svelte/icons/copy';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Mail from '@lucide/svelte/icons/mail';
	import MailCheck from '@lucide/svelte/icons/mail-check';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Pencil from '@lucide/svelte/icons/pencil';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Square from '@lucide/svelte/icons/square';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { Finding } from '@tran/core/fair-housing';
	import { resolve } from '$app/paths';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { hostFor } from '../models';
	import type { AiArtifact, ArtifactRepo } from '../storage/artifacts';
	import { sampleNotice, statusCopy } from './ai-copy';
	import FairHousingText from './FairHousingText.svelte';
	import FindingsSummary from './FindingsSummary.svelte';
	import GeminiDataDialog from './GeminiDataDialog.svelte';
	import GenerationError from './GenerationError.svelte';
	import type { ExitDisabled, ExitKind, FormatForExit, PostCheck } from './panel-controller';
	import type { CheckGroupCopy } from './post-check';
	import { PanelState, type ExitEventPayload, type Resolved } from './panel-state.svelte';
	import PlatformCard, { packAnnouncement } from './PlatformCard.svelte';
	import ProviderChip from './ProviderChip.svelte';

	let {
		feature,
		promptId,
		inputs,
		title,
		headingLevel = 3,
		generateLabel = 'Generate draft',
		mailto,
		containsClientData,
		postChecks = [],
		tokens = {},
		emailFooter,
		formatForExit,
		exitDisabled = {},
		onExit,
		subjectId,
		beforeGenerate,
		checkGroups = [],
		artifactMeta,
		sections,
		// Read-only outputs: written by the $effect below, never read here.
		/* eslint-disable no-useless-assignment */
		canExit = $bindable(false),
		blocked = $bindable(false),
		findings = $bindable([]),
		savedId = $bindable(null),
		artifactId = $bindable(null),
		draftText = $bindable(''),
		/* eslint-enable no-useless-assignment */
		state: provided
	}: {
		feature: string;
		promptId: string;
		inputs: unknown;
		title: string;
		headingLevel?: 2 | 3;
		generateLabel?: string;
		mailto?: { to?: string; subject?: string };
		containsClientData?: boolean;
		postChecks?: PostCheck[];
		tokens?: Record<string, string>;
		emailFooter?: { text: string; label: string };
		/**
		 * Phase 9: shapes the Copy text, email body and Mark as sent payloads as
		 * formatForExit(draft, emailFooter?.text ?? ''). Absent: draft plus emailFooter (Phase 5/8).
		 */
		formatForExit?: FormatForExit;
		exitDisabled?: ExitDisabled;
		onExit?: (kind: ExitKind, payload: ExitEventPayload) => void;
		/**
		 * Opaque id stored on each saved draft (Phase 6: the listing id). Pass the same value to
		 * DraftHistory to filter it. Absent: drafts are stored without one (Phase 5 behavior).
		 */
		subjectId?: string;
		/**
		 * Phase 6 host hook: runs when the renter presses the generate control (not Stop). Return
		 * false to skip the run, e.g. after the host form showed its own field errors. Absent: runs.
		 */
		beforeGenerate?: () => boolean;
		/**
		 * Phase 7: presentational copy for post-check groups (titles, hidden mark prefixes, popover
		 * variants, done sentence). Carries no check logic: gating stays postChecks + Phase 5's
		 * controller. Absent: every finding shows in the Fair Housing group (Phase 5 behavior).
		 */
		checkGroups?: CheckGroupCopy[];
		/** Phase 7: string metadata stored on each saved draft (e.g. the memo's analysisHash). */
		artifactMeta?: Record<string, string>;
		/**
		 * Phase 9 sections mode: one PlatformCard per section (fixed order), each with its own checks,
		 * count, disclosure block and one Copy exit. `exitDisabled.copy` gates every card's Copy.
		 * Absent: default mode with the three Phase 5 exits.
		 */
		sections?: SectionSpec[];
		canExit?: boolean;
		blocked?: boolean;
		findings?: Finding[];
		/** Read-only: the id of the stored draft shown in the panel (changes after each save/open). */
		savedId?: string | null;
		/** Read-only: mirrors the panel's stored draft id (Phase 7 hosts). */
		artifactId?: string | null;
		/** Read-only: mirrors the panel's current draft text (Phase 7 hosts). */
		draftText?: string;
		state?: PanelState;
	} = $props();

	const id = $props.id();
	let repo = $state<ArtifactRepo | null>(null);
	let openRouterSaved = false;

	/** Live wiring: Phase 3 vault + AI prefs, loaded only when a run is requested. */
	async function resolveLive(): Promise<Resolved> {
		const [setup, secrets, prefs] = await Promise.all([
			import('../setup'),
			import('$lib/storage/secrets'),
			import('../prefs.svelte')
		]);
		const vault = await secrets.getVault();
		const keyState = setup.keyStateFrom(vault);
		openRouterSaved = keyState('openrouter') === 'saved';
		const selection = setup.selectProvider({
			preferred: prefs.aiPrefs.provider,
			sample: prefs.aiPrefs.sample,
			keyState
		});
		const provider = setup.resolveProvider(selection, { getKey: (p) => vault.getKey(p) });
		const model = selection.kind === 'sample' ? '' : prefs.aiPrefs.effectiveModel(selection.id);
		return { selection, provider, model };
	}

	// Getters keep the deps reactive to prop changes.
	function ownState(): PanelState {
		return new PanelState({
			get promptId() {
				return promptId;
			},
			get inputs() {
				return inputs;
			},
			get feature() {
				return feature;
			},
			get containsClientData() {
				return containsClientData;
			},
			get postChecks() {
				return postChecks;
			},
			get tokens() {
				return tokens;
			},
			get emailFooter() {
				return emailFooter;
			},
			get formatForExit() {
				return formatForExit;
			},
			get exitDisabled() {
				return exitDisabled;
			},
			get mailto() {
				return mailto;
			},
			get onExit() {
				return onExit;
			},
			get subjectId() {
				return subjectId;
			},
			get checkGroups() {
				return checkGroups;
			},
			get artifactMeta() {
				return artifactMeta;
			},
			get repo() {
				return repo;
			},
			resolve: resolveLive,
			announce,
			openRouterKeySaved: () => openRouterSaved
		});
	}

	// svelte-ignore state_referenced_locally
	const st: PanelState = provided ?? ownState();

	onMount(() => {
		if (provided) return;
		void import('../storage/artifacts').then((m) => (repo = m.createArtifactRepo()));
		void st.preview();
	});

	// Read-only bindables for consumers gating their own actions.
	$effect(() => {
		canExit = st.gate.canExit;
		blocked = st.gate.blocked;
		findings = st.findings;
		savedId = st.artifactId;
		artifactId = st.artifactId;
		draftText = st.text;
	});

	/**
	 * Draft history "Open" (05-UI-SPEC focus table): loads the stored draft into this panel and
	 * moves focus to the output box. Called by the host through bind:this.
	 */
	export async function openArtifact(artifact: AiArtifact): Promise<void> {
		st.open(artifact);
		await tick();
		outputEl?.focus();
	}

	/** Re-reads the provider selection (chip + "What will be sent") after a Settings change. */
	export function refreshProvider(): void {
		if (!st.running) void st.preview();
	}

	const titleId = `${id}-title`;
	const findingsTitleId = `${id}-findings-title`;
	const helperId = `${id}-exit-helper`;
	const longId = `${id}-mailto-long`;

	let runEl = $state<HTMLElement | null>(null);
	let editEl = $state<HTMLElement | null>(null);
	let outputEl = $state<HTMLElement | null>(null);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let openFindingId = $state<string | null>(null);

	const gate = $derived(st.gate);
	const sent = $derived(st.artifactStatus === 'sent');
	const sel = $derived(st.selection);
	const notice = $derived(
		sel?.kind === 'sample' ? sampleNotice(sel.reason, st.providerLabel) : null
	);
	const settingsHref = (hash: string) => `${resolve('/settings/')}#${hash}`;

	// One reason line per distinct reason; each gated exit points at its own.
	const EXITS: ExitKind[] = ['copy', 'email', 'marked-sent'];
	const reasons = $derived.by(() => {
		const list: { id: string; text: string; tone: 'block' | 'warn' | 'own' }[] = [];
		for (const k of EXITS) {
			const r = gate.exits[k].reason;
			if (!r || list.some((x) => x.text === r)) continue;
			const tone = r === gate.reason ? (gate.blocked ? 'block' : 'warn') : 'own';
			list.push({ id: `${id}-exit-reason-${list.length}`, text: r, tone });
		}
		return list;
	});
	function describedBy(k: ExitKind): string {
		const r = gate.exits[k].reason;
		const reasonId = r ? reasons.find((x) => x.text === r)?.id : undefined;
		return [reasonId, helperId].filter(Boolean).join(' ');
	}

	// Phase 3 disabled visuals for aria-disabled controls (never opacity alone).
	const GATED =
		'aria-disabled:border aria-disabled:border-border aria-disabled:bg-surface aria-disabled:text-muted-foreground aria-disabled:hover:bg-surface';

	async function onRun(): Promise<void> {
		if (st.running) st.stop();
		else if (beforeGenerate?.() ?? true) await st.generate();
	}

	async function toggleEdit(): Promise<void> {
		if (st.editing) {
			st.recheckNow();
			st.editing = false;
			await tick();
			editEl?.focus();
		} else {
			st.editing = true;
			await tick();
			const end = st.text.length;
			textareaEl?.focus();
			textareaEl?.setSelectionRange(end, end);
		}
	}

	function triggerFor(findingId: string): HTMLElement | null {
		return (
			outputEl?.querySelector<HTMLElement>(
				`[aria-controls="${id}-finding-${findingId}-popover"]`
			) ?? null
		);
	}

	function focusFindingsTitle(): void {
		document.getElementById(findingsTitleId)?.focus();
	}

	async function onApply(findingId: string): Promise<void> {
		const { nextFindingId } = st.apply(findingId);
		await tick();
		const next = nextFindingId ? triggerFor(nextFindingId) : null;
		if (next) next.focus();
		else focusFindingsTitle();
	}

	async function onShow(findingId: string): Promise<void> {
		if (st.editing) {
			st.recheckNow();
			st.editing = false;
			await tick();
		}
		const el = triggerFor(findingId);
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		el?.scrollIntoView({ block: 'center', behavior: reduce ? 'instant' : 'smooth' });
		el?.focus();
	}

	async function onEditFinding(findingId: string): Promise<void> {
		const f = st.findings.find((x) => x.id === findingId);
		st.editing = true;
		await tick();
		textareaEl?.focus();
		if (f) textareaEl?.setSelectionRange(f.start, f.end);
	}

	function selectOutput(): void {
		if (st.editing) {
			textareaEl?.select();
			return;
		}
		const range = document.createRange();
		if (!outputEl) return;
		range.selectNodeContents(outputEl);
		const s = window.getSelection();
		s?.removeAllRanges();
		s?.addRange(range);
	}

	async function onCopy(): Promise<void> {
		if (gate.exits.copy.gated) {
			focusFindingsTitle();
			await st.copy(); // announces the reason, does nothing else
			return;
		}
		if (!(await st.copy())) selectOutput();
	}

	function onEmail(e: MouseEvent | KeyboardEvent): void {
		if (gate.exits.email.gated) {
			e.preventDefault();
			focusFindingsTitle();
		}
		st.emailClicked();
	}

	function onEmailKey(e: KeyboardEvent): void {
		// A gated link has no href, so Enter would do nothing natively.
		if (e.key === 'Enter' && gate.exits.email.gated) onEmail(e);
	}

	async function onMarkSent(): Promise<void> {
		if (gate.exits['marked-sent'].gated) focusFindingsTitle();
		await st.markSent();
	}

	// Sections mode (Phase 9). One announcement when a run ends cleanly: the pack summary replaces
	// Phase 5's "Draft ready." sentence, which only describes the whole pack text.
	const DONE_LINE = statusCopy('done', { providerLabel: '' }).line;
	let wasRunning = false;
	$effect(() => {
		const running = st.running;
		if (
			wasRunning &&
			!running &&
			sections &&
			st.error === null &&
			st.statusLine === DONE_LINE &&
			st.text !== ''
		) {
			st.deps.announce(packAnnouncement(sections, st.text));
		}
		wasRunning = running;
	});

	/** A card copied: the pack's Draft history row becomes Reviewed once, then the host hears it. */
	async function onSectionCopied(text: string): Promise<void> {
		const artifactId = st.artifactId;
		if (artifactId && st.artifactStatus === 'draft') {
			st.artifactStatus = 'acknowledged';
			const at = st.deps.now?.() ?? new Date();
			await st.deps.repo?.setStatus(artifactId, 'acknowledged', at);
		}
		onExit?.('copy', { text, artifactId });
	}
</script>

<section
	aria-labelledby={titleId}
	aria-busy={st.running ? 'true' : undefined}
	class="flex {sections
		? 'w-full'
		: 'max-w-160'} flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6"
>
	<!-- 1. Header row -->
	<div class="flex flex-wrap items-center justify-between gap-2">
		<svelte:element
			this={`h${headingLevel}`}
			id={titleId}
			class="font-display text-heading font-semibold text-foreground">{title}</svelte:element
		>
		{#if sel?.kind === 'live'}
			<ProviderChip kind="live" providerLabel={st.providerLabel} model={st.model} />
		{:else}
			<ProviderChip kind="sample" />
		{/if}
	</div>

	<!-- 2. Sample notice -->
	{#if notice}
		<p class="text-base leading-[1.6] text-muted-foreground">
			{notice.text}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus a same-page fragment -->
			<a href={settingsHref(notice.link.hash)} class="text-primary underline">{notice.link.label}</a
			>
		</p>
	{/if}

	<!-- 3. What will be sent -->
	<details
		class="group"
		ontoggle={(e) => {
			if ((e.currentTarget as HTMLDetailsElement).open) void st.preview();
		}}
	>
		<summary
			class="flex min-h-11 cursor-pointer touch-manipulation list-none items-center gap-2 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden"
		>
			<ChevronRight
				size={16}
				aria-hidden="true"
				class="shrink-0 group-open:rotate-90 motion-safe:transition-transform"
			/>What will be sent
		</summary>
		<div class="mt-4 flex flex-col gap-4 text-base leading-[1.6] text-foreground">
			{#if sel}
				{#if sel.kind === 'sample'}
					<p>Nothing is sent. Sample output is written in this browser.</p>
				{:else}
					<p>
						Sent to {st.providerLabel} at <code>{hostFor(sel.id)}</code>, using
						<code>{st.model}</code>.
					</p>
				{/if}
				{#if sections}
					<p>
						Your disclosure is added in this browser after the draft is written. It isn't sent to {st.providerLabel}.
					</p>
				{/if}
			{/if}
			{#if st.built}
				{#if st.built.redactions.length > 0}
					<div class="flex flex-col gap-2">
						<p class="font-semibold">Replaced before sending</p>
						<ul class="flex flex-col gap-1">
							{#each st.built.redactions as r (r.token + r.original)}
								<li>{r.original} → <code>{`{${r.token}}`}</code></li>
							{/each}
						</ul>
					</div>
				{:else}
					<p>No names, emails, or phone numbers were found to replace.</p>
				{/if}
				<div class="flex flex-col gap-2">
					<p class="font-semibold">Instructions</p>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						tabindex="0"
						role="group"
						aria-label="Instructions"
						class="max-h-80 overflow-y-auto rounded-md bg-surface p-4 [overflow-wrap:anywhere] whitespace-pre-wrap"
					>
						{st.built.system}
					</div>
				</div>
				<div class="flex flex-col gap-2">
					<p class="font-semibold">Details</p>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						tabindex="0"
						role="group"
						aria-label="Details"
						class="max-h-80 overflow-y-auto rounded-md bg-surface p-4 [overflow-wrap:anywhere] whitespace-pre-wrap"
					>
						{st.built.user}
					</div>
				</div>
			{/if}
		</div>
	</details>

	<!-- 4. Run control (one element; label and variant swap, focus stays) -->
	<div class="flex flex-col gap-2">
		<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
			<Button
				bind:ref={runEl}
				variant={st.running || st.hasDraft ? 'outline' : 'default'}
				onclick={onRun}
				class="w-full sm:w-auto"
			>
				{#if st.running}
					<Square size={16} aria-hidden="true" />Stop
				{:else if st.hasDraft}
					<RotateCcw size={16} aria-hidden="true" />Generate again
				{:else}
					<PenLine size={16} aria-hidden="true" />{generateLabel}
				{/if}
			</Button>
			{#if st.hasDraft && !st.running && !sections}
				<Button bind:ref={editEl} variant="outline" onclick={toggleEdit} class="w-full sm:w-auto">
					{#if st.editing}
						<Check size={16} aria-hidden="true" />Done editing
					{:else}
						<Pencil size={16} aria-hidden="true" />Edit draft
					{/if}
				</Button>
			{/if}
		</div>
		{#if st.hasDraft && !st.running}
			<p class="text-label text-muted-foreground">Your current draft stays in Draft history.</p>
		{/if}
	</div>

	<!-- 5. Status line (announced separately through the LiveAnnouncer) -->
	{#if st.statusLine}
		<p class="flex items-center gap-2 text-label text-muted-foreground">
			{#if st.phase === 'connecting'}
				<LoaderCircle size={16} aria-hidden="true" class="shrink-0 motion-safe:animate-spin" />
			{/if}
			{st.statusLine}
		</p>
	{/if}

	<!-- 6. Output box: not a live region. Sections mode: one PlatformCard per section instead. -->
	{#if sections}
		<div class="grid grid-cols-1 gap-6 xl:grid-cols-3" data-platform-cards="">
			{#key st.artifactId}
				{#each sections as spec (spec.key)}
					<PlatformCard
						{spec}
						fullText={st.text}
						streaming={st.running}
						hasDraft={st.hasDraft}
						idPrefix={id}
						headingLevel={headingLevel === 2 ? 3 : 4}
						{checkGroups}
						exitDisabledReason={exitDisabled.copy ?? null}
						clipboard={st.deps.clipboard}
						announce={st.deps.announce}
						onCopied={(_key, text) => void onSectionCopied(text)}
					/>
				{/each}
			{/key}
		</div>
	{:else if st.editing}
		<div class="flex flex-col gap-2">
			<label for={`${id}-edit`} class="text-base font-semibold text-foreground"
				>Edit your draft</label
			>
			<Textarea
				id={`${id}-edit`}
				bind:ref={textareaEl}
				value={st.text}
				oninput={(e) => st.setText((e.currentTarget as HTMLTextAreaElement).value)}
			/>
		</div>
	{:else}
		<div
			bind:this={outputEl}
			tabindex="-1"
			role="group"
			aria-label="Draft"
			data-generation-output=""
			class="min-h-40 rounded-md border border-border bg-background p-4 text-base leading-[1.6] [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground"
		>
			{#if st.hasDraft}
				<FairHousingText
					text={st.text}
					findings={st.findings}
					idPrefix={id}
					{checkGroups}
					{onApply}
					onEdit={onEditFinding}
					bind:openId={openFindingId}
				/>{#if st.running}<span
						aria-hidden="true"
						class="caret ml-px inline-block h-[1em] w-0.5 bg-foreground align-[-0.125em]"
					></span>{/if}
			{:else}
				<span class="text-muted-foreground"
					>Your draft will appear here. Nothing leaves this page until you copy it or open it in
					your email app.</span
				>
			{/if}
		</div>
	{/if}

	<!-- 7. Email footer preview (outside the exits group) -->
	{#if emailFooter && !sections}
		<p class="text-label whitespace-pre-wrap text-muted-foreground">
			{emailFooter.label}: {emailFooter.text}
		</p>
	{/if}

	<!-- 8. Usage line -->
	{#if st.usageText}
		<p class="text-label text-muted-foreground tabular-nums">{st.usageText}</p>
	{/if}

	<!-- 9. Error -->
	{#if st.error}
		<GenerationError
			title={st.error.title}
			body={st.error.body}
			action={st.error.action}
			model={st.model || undefined}
		/>
	{/if}

	<!-- 10. Fair Housing findings -->
	{#if st.hasDraft && !st.running && !sections}
		<FindingsSummary
			findings={st.findings}
			idPrefix={id}
			headingLevel={headingLevel === 2 ? 3 : 4}
			{checkGroups}
			bind:acknowledged={st.warnAck}
			{onApply}
			{onShow}
			onEdit={onEditFinding}
		/>
	{/if}

	<!-- 11. Long mailto note -->
	{#if st.hasDraft && st.mailto.long && !sections}
		<p id={longId} class="flex items-start gap-2 text-label text-foreground">
			<TriangleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0" />This draft is long, so
			some email apps may cut it off. If it arrives incomplete, use Copy text instead.
		</p>
	{/if}

	<!-- 12. Exits: exactly three (sections mode: one per card instead) -->
	{#if !sections}<div class="flex flex-col gap-2">
			<div
				role="group"
				aria-label="Use this draft"
				data-testid="generation-exits"
				class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4"
			>
				<Button
					variant={st.hasDraft ? 'default' : 'outline'}
					aria-disabled={gate.exits.copy.gated ? 'true' : undefined}
					aria-describedby={describedBy('copy')}
					onclick={onCopy}
					class="w-full sm:w-auto {GATED}"><Copy size={16} aria-hidden="true" />Copy text</Button
				>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- an email-app link built by exits.ts buildMailto, not app navigation -->
				<a
					href={gate.exits.email.gated ? undefined : st.mailto.href}
					role={gate.exits.email.gated ? 'link' : undefined}
					tabindex={gate.exits.email.gated ? 0 : undefined}
					aria-disabled={gate.exits.email.gated ? 'true' : undefined}
					aria-describedby={describedBy('email')}
					onclick={onEmail}
					onkeydown={onEmailKey}
					class={buttonVariants({ variant: 'outline', class: `w-full sm:w-auto ${GATED}` })}
					><Mail size={16} aria-hidden="true" />Open in email app</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<Button
					variant="ghost"
					aria-disabled={gate.exits['marked-sent'].gated ? 'true' : undefined}
					aria-pressed={sent ? 'true' : undefined}
					aria-describedby={describedBy('marked-sent')}
					onclick={onMarkSent}
					class="w-full sm:w-auto {GATED}"
					><MailCheck size={16} aria-hidden="true" />{sent
						? 'Marked as sent'
						: 'Mark as sent'}</Button
				>
			</div>
			{#each reasons as r (r.id)}
				<p id={r.id} class="flex items-start gap-2 text-label text-foreground">
					{#if r.tone === 'warn'}
						<TriangleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0" />
					{:else}
						<CircleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0 text-destructive" />
					{/if}
					{r.text}
				</p>
			{/each}
			<p id={helperId} class="text-label text-muted-foreground">
				Tran never sends anything for you. Copy the text or open it in your email app, then send it
				yourself. Mark as sent only updates Draft history in this browser.
			</p>
		</div>{/if}
</section>

<!-- Caller-owned dialog, outside every state branch. -->
<GeminiDataDialog
	bind:open={st.geminiDialogOpen}
	idPrefix={`${id}-gemini`}
	onCancel={() => st.cancelGemini()}
	onSend={(dontAsk) => void st.confirmGemini(dontAsk)}
	onCloseAutoFocus={(e) => {
		e.preventDefault();
		runEl?.focus();
	}}
/>

<style>
	/* Streaming caret: 1s steps(1) blink, static under reduced motion. */
	@media (prefers-reduced-motion: no-preference) {
		.caret {
			animation: caret-blink 1s steps(1) infinite;
		}
	}
	@keyframes caret-blink {
		50% {
			opacity: 0;
		}
	}
</style>
