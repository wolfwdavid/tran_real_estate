<script module lang="ts">
	// 09-UI-SPEC "PlatformCard anatomy": one card per section of a GenerationPanel `sections` run
	// (the social post pack). The card owns its own checks, count, edit mode and exactly ONE exit,
	// "Copy {Platform} post", which goes through exits.ts copyText like every other AI exit.
	//
	// Disclosure-last by construction: the copied text is always `spec.assemble(text).text`, and
	// the host's assemble appends `spec.emailFooter.text` after the body and hashtags. The
	// disclosure is shown read-only, never checked and never truncated.
	import { HASHTAG_CAPS } from '@tran/core/studio';
	import { WARN_REASON, blockReason, runChecks, type PostCheck } from './panel-controller';

	export type SectionKey = 'instagram' | 'facebook' | 'linkedin';
	export type SectionState = 'empty' | 'streaming' | 'ok' | 'error';

	export interface SectionAssembly {
		text: string;
		length: number;
		limit: number;
		over: number;
		keptTags: string[];
		droppedTags: number;
		tagsOverCap: number;
	}

	export interface SectionSpec {
		key: SectionKey;
		label: string;
		constraintLine: string;
		/**
		 * Same shape as the panel's emailFooter: text = the ad-inline disclosure, label = the block
		 * label ('Added to the end of this post' for the social pack).
		 */
		emailFooter: { text: string; label: string };
		/** Body + '\n\n' + tag line for this section of the full pack text. */
		extract: (fullText: string, streaming: boolean) => { state: SectionState; text: string };
		/** Body, capped tags, then the disclosure, always last. */
		assemble: (sectionText: string) => SectionAssembly;
		postChecks?: PostCheck[];
	}

	const INT = new Intl.NumberFormat('en-US');

	/**
	 * Why this card's Copy is gated, in UI-SPEC priority order, or null when it is enabled.
	 * `exitDisabledReason` is the panel's `exitDisabled.copy` (the profile gate) and comes last.
	 */
	export function cardGate(i: {
		mustFix: number;
		unackedReview: number;
		over: number;
		tagsOverCap: number;
		exitDisabledReason: string | null;
		label: string;
		cap: number;
		limit: number;
	}): string | null {
		if (i.mustFix > 0) return blockReason(i.mustFix);
		if (i.unackedReview > 0) return WARN_REASON;
		if (i.over > 0)
			return `${INT.format(i.over)} characters over ${i.label}'s limit. Shorten the post to copy it.`;
		if (i.tagsOverCap > 0)
			return `${i.label} uses up to ${i.cap} hashtags. Remove ${i.tagsOverCap} to copy this post.`;
		return i.exitDisabledReason || null;
	}

	/** The exact clipboard text for a card: the assembled post, disclosure last. */
	export function cardPayload(spec: SectionSpec, sectionText: string): string {
		return spec.assemble(sectionText).text;
	}

	/** "{n} of {limit} characters, including your disclosure." (Facebook names its own limit.) */
	export function countLine(spec: SectionSpec, a: SectionAssembly): string {
		const base =
			spec.key === 'facebook'
				? `${INT.format(a.length)} characters, including your disclosure. Facebook allows up to ${INT.format(a.limit)}.`
				: `${INT.format(a.length)} of ${INT.format(a.limit)} characters, including your disclosure.`;
		return a.over > 0
			? `${base} ${INT.format(a.over)} characters over ${spec.label}'s limit. Shorten the post.`
			: base;
	}

	export function droppedLine(spec: SectionSpec, a: SectionAssembly): string | null {
		if (a.droppedTags <= 0) return null;
		const cap = HASHTAG_CAPS[spec.key];
		return `${spec.label} uses up to ${cap} hashtags, so Tran kept the first ${cap} and left out ${a.droppedTags}.`;
	}

	export const parseErrorTitle = (label: string): string => `The ${label} post didn't come through`;
	export const PARSE_ERROR_BODY =
		'The draft for this card was missing or empty. Generate again, or use Edit post to write it yourself.';
	export const CARD_EMPTY_LINE =
		'Your Instagram, Facebook, and LinkedIn posts will appear here. Nothing leaves this page until you copy a post.';
	export const COPY_FAILED = `Your browser didn't allow copying. The post is selected, so press Ctrl+C or ${String.fromCharCode(0x2318)}C to copy it.`;

	/** One card's word in the "Post pack ready." announcement; null when the section is missing. */
	export function cardSentence(spec: SectionSpec, fullText: string): string | null {
		const ex = spec.extract(fullText, false);
		if (ex.state !== 'ok' || ex.text.trim() === '') return null;
		const findings = runChecks(ex.text, spec.postChecks);
		const block = findings.filter((f) => f.severity === 'block').length;
		const warn = findings.length - block;
		if (block > 0) return `${block} to fix`;
		if (warn > 0) return `${warn} to review`;
		if (spec.assemble(ex.text).over > 0) return 'over the limit';
		return 'ready to copy';
	}

	/**
	 * "Post pack ready. Instagram: ready to copy. ..." for the sections that came through, then
	 * "The {Platform} post didn't come through." once for each one that didn't.
	 */
	export function packAnnouncement(specs: readonly SectionSpec[], fullText: string): string {
		const ok: string[] = [];
		const failed: string[] = [];
		for (const spec of specs) {
			const s = cardSentence(spec, fullText);
			if (s === null) failed.push(`${parseErrorTitle(spec.label)}.`);
			else ok.push(`${spec.label}: ${s}.`);
		}
		return [...(ok.length > 0 ? ['Post pack ready.', ...ok] : []), ...failed].join(' ');
	}

	/** Artifact meta key holding the platforms copied from a pack ("instagram,linkedin"). */
	export const COPIED_META_KEY = 'copied';
	const SECTION_ORDER: readonly SectionKey[] = ['instagram', 'facebook', 'linkedin'];

	/** The stored copied list with `key` added, in card order and without repeats. */
	export function withCopied(prev: string | undefined, key: SectionKey): string {
		const have = [...(prev ?? '').split(','), key];
		return SECTION_ORDER.filter((k) => have.includes(k)).join(',');
	}

	/** Draft history row extra: "Copied: Instagram, LinkedIn", or null when nothing was copied. */
	export function copiedNote(
		meta: Readonly<Record<string, string>> | undefined,
		labels: Readonly<Record<SectionKey, string>>
	): string | null {
		const keys = (meta?.[COPIED_META_KEY] ?? '').split(',');
		const names = SECTION_ORDER.filter((k) => keys.includes(k)).map((k) => labels[k]);
		return names.length > 0 ? `Copied: ${names.join(', ')}` : null;
	}
</script>

<script lang="ts">
	import { tick, untrack } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Copy from '@lucide/svelte/icons/copy';
	import Pencil from '@lucide/svelte/icons/pencil';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { applyAlternative } from '@tran/core/fair-housing';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { copyText } from '../exits';
	import FairHousingText from './FairHousingText.svelte';
	import FindingsSummary from './FindingsSummary.svelte';
	import { warnSignature } from './panel-controller';
	import type { CheckGroupCopy } from './post-check';

	let {
		spec,
		fullText,
		streaming,
		hasDraft,
		idPrefix,
		headingLevel = 3,
		checkGroups = [],
		exitDisabledReason = null,
		clipboard,
		announce,
		onCopied,
		recheckMs = 300
	}: {
		spec: SectionSpec;
		/** The whole pack text from the panel's run (never edited here). */
		fullText: string;
		streaming: boolean;
		/** The panel has any text (before a run every card shows the empty line). */
		hasDraft: boolean;
		idPrefix: string;
		headingLevel?: 3 | 4;
		checkGroups?: readonly CheckGroupCopy[];
		/** The panel's `exitDisabled.copy` (profile gate), shown after every other reason. */
		exitDisabledReason?: string | null;
		clipboard?: { writeText(t: string): Promise<void> };
		announce: (message: string) => void;
		/** Called after a successful copy with the exact clipboard text. */
		onCopied?: (key: SectionKey, text: string) => void;
		recheckMs?: number;
	} = $props();

	const base = $derived(`${idPrefix}-${spec.key}`);
	const titleId = $derived(`${base}-title`);
	const reasonId = $derived(`${base}-reason`);
	const statusId = $derived(`${base}-status`);

	/** The agent's own edit of this section; null = the generated text. */
	let override = $state<string | null>(null);
	let editing = $state(false);
	/** Text the checks last ran on while editing (rechecked `recheckMs` after typing stops). */
	let checkedEdit = $state('');
	/** Warn signature the agent acknowledged; void once the set of Review phrases changes. */
	let ackSig = $state<string | null>(null);
	let statusLine = $state('');
	let openFindingId = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	let outputEl = $state<HTMLElement | null>(null);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let editEl = $state<HTMLElement | null>(null);
	let reasonEl = $state<HTMLElement | null>(null);

	const ex = $derived(spec.extract(fullText, streaming));
	const generated = $derived(ex.state === 'ok' || ex.state === 'streaming' ? ex.text : '');
	const text = $derived(override ?? generated);
	const failed = $derived(!streaming && hasDraft && override === null && ex.state !== 'ok');
	const ready = $derived(!streaming && hasDraft && !failed && text.trim() !== '');
	const busy = $derived(streaming && ex.state === 'streaming');

	const findings = $derived(ready ? runChecks(editing ? checkedEdit : text, spec.postChecks) : []);
	const blockCount = $derived(findings.filter((f) => f.severity === 'block').length);
	const warnCount = $derived(findings.length - blockCount);
	const acknowledged = $derived(ackSig !== null && ackSig === warnSignature(findings));
	const assembled = $derived(ready ? spec.assemble(text) : null);

	const reason = $derived(
		assembled
			? cardGate({
					mustFix: blockCount,
					unackedReview: acknowledged ? 0 : warnCount,
					over: assembled.over,
					// User-added tags past the cap gate Copy; tags the model over-supplied are
					// dropped by assemble and reported on the dropped line instead.
					tagsOverCap: override !== null ? assembled.tagsOverCap : 0,
					exitDisabledReason,
					label: spec.label,
					cap: HASHTAG_CAPS[spec.key],
					limit: assembled.limit
				})
			: null
	);
	const gated = $derived(!ready || reason !== null);
	const dropped = $derived(assembled && override === null ? droppedLine(spec, assembled) : null);

	// A new run starts from the generated text again.
	$effect(() => {
		if (!streaming) return;
		untrack(() => {
			clearTimeout(timer);
			override = null;
			editing = false;
			ackSig = null;
			statusLine = '';
		});
	});

	const GATED =
		'aria-disabled:border aria-disabled:border-border aria-disabled:bg-surface aria-disabled:text-muted-foreground aria-disabled:hover:bg-surface';

	function findingsTitle(): HTMLElement | null {
		return document.getElementById(`${base}-findings-title`);
	}

	function triggerFor(findingId: string): HTMLElement | null {
		return (
			outputEl?.querySelector<HTMLElement>(
				`[aria-controls="${base}-finding-${findingId}-popover"]`
			) ?? null
		);
	}

	function setEdit(value: string): void {
		override = value === generated ? null : value;
	}

	async function toggleEdit(): Promise<void> {
		if (editing) {
			clearTimeout(timer);
			const value = textareaEl?.value ?? text;
			setEdit(value);
			checkedEdit = value;
			editing = false;
			await tick();
			editEl?.focus();
		} else {
			checkedEdit = text;
			editing = true;
			await tick();
			const end = text.length;
			textareaEl?.focus();
			textareaEl?.setSelectionRange(end, end);
		}
	}

	function onInput(value: string): void {
		override = value;
		clearTimeout(timer);
		timer = setTimeout(() => (checkedEdit = value), recheckMs);
	}

	async function onApply(findingId: string): Promise<void> {
		const f = findings.find((x) => x.id === findingId);
		if (!f) return;
		const alternative =
			(f.members.find((m) => m.severity === 'block') ?? f.members[0])?.alternative ?? '';
		const next = applyAlternative(text, f);
		setEdit(next.text);
		checkedEdit = next.text;
		const left = findings.length;
		const lead = alternative === '' ? 'Removed the phrase.' : `Replaced with "${alternative}".`;
		announce(
			`${lead} ${left === 0 ? 'No Fair Housing flags left.' : left === 1 ? '1 flag left.' : `${left} flags left.`}`
		);
		await tick();
		const sorted = [...findings].sort((a, b) => a.start - b.start);
		const target = sorted.find((x) => x.start >= next.cursor) ?? sorted[0];
		const el = target ? triggerFor(target.id) : null;
		if (el) el.focus();
		else findingsTitle()?.focus();
	}

	async function onShow(findingId: string): Promise<void> {
		if (editing) await toggleEdit();
		const el = triggerFor(findingId);
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		el?.scrollIntoView({ block: 'center', behavior: reduce ? 'instant' : 'smooth' });
		el?.focus();
	}

	async function onEditFinding(findingId: string): Promise<void> {
		const f = findings.find((x) => x.id === findingId);
		if (!editing) {
			checkedEdit = text;
			editing = true;
		}
		await tick();
		textareaEl?.focus();
		if (f) textareaEl?.setSelectionRange(f.start, f.end);
	}

	function selectOutput(): void {
		if (editing) {
			textareaEl?.select();
			return;
		}
		if (!outputEl) return;
		const range = document.createRange();
		range.selectNodeContents(outputEl);
		const s = window.getSelection();
		s?.removeAllRanges();
		s?.addRange(range);
	}

	async function onCopy(): Promise<void> {
		// Check the text as it is right now: the edit recheck lags typing by recheckMs.
		const current = text;
		if (editing && checkedEdit !== current) {
			clearTimeout(timer);
			checkedEdit = current;
		}
		// findings / reason / gated are $derived and recompute synchronously on read.
		if (gated) {
			if (reason) {
				await tick(); // the reason line may only now exist
				reasonEl?.focus();
				announce(reason);
			}
			return;
		}
		const payload = cardPayload(spec, current); // only the text that was just checked
		if (await copyText(payload, clipboard)) {
			statusLine = 'Copied.';
			announce(`${spec.label} post copied.`);
			onCopied?.(spec.key, payload);
		} else {
			statusLine = COPY_FAILED;
			announce(COPY_FAILED);
			selectOutput();
		}
	}
</script>

<article
	aria-labelledby={titleId}
	aria-busy={busy ? 'true' : undefined}
	data-platform-card={spec.key}
	class="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6"
>
	<!-- 1. Header -->
	<div class="flex flex-col gap-1">
		<svelte:element
			this={`h${headingLevel}`}
			id={titleId}
			class="text-base leading-[1.6] font-semibold text-foreground">{spec.label}</svelte:element
		>
		<p class="text-label text-muted-foreground">{spec.constraintLine}</p>
	</div>

	<!-- 2. Output box / edit mode -->
	{#if editing}
		<div class="flex flex-col gap-2">
			<label for={`${base}-edit`} class="text-base font-semibold text-foreground"
				>Edit your {spec.label} post</label
			>
			<Textarea
				id={`${base}-edit`}
				bind:ref={textareaEl}
				value={text}
				class="min-h-40"
				oninput={(e) => onInput((e.currentTarget as HTMLTextAreaElement).value)}
			/>
		</div>
	{:else}
		<div
			bind:this={outputEl}
			tabindex="-1"
			role="group"
			aria-label={`${spec.label} post`}
			data-generation-output={spec.key}
			class="min-h-40 rounded-md border border-border bg-background p-4 text-base leading-[1.6] [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground"
		>
			{#if failed}
				<div class="flex items-start gap-3 rounded-md bg-surface p-4 whitespace-normal">
					<SearchX size={20} aria-hidden="true" class="mt-0.5 shrink-0 text-muted-foreground" />
					<div class="flex flex-col gap-1">
						<p class="font-semibold text-foreground">{parseErrorTitle(spec.label)}</p>
						<p class="text-foreground">{PARSE_ERROR_BODY}</p>
					</div>
				</div>
			{:else if !hasDraft}
				<span class="text-muted-foreground">{CARD_EMPTY_LINE}</span>
			{:else if text !== ''}
				<FairHousingText
					{text}
					{findings}
					idPrefix={base}
					{checkGroups}
					{onApply}
					onEdit={onEditFinding}
					bind:openId={openFindingId}
				/>{#if busy}<span
						aria-hidden="true"
						class="caret ml-px inline-block h-[1em] w-0.5 bg-foreground align-[-0.125em]"
					></span>{/if}
			{/if}
		</div>
	{/if}

	<!-- 3. Disclosure block: read-only, never checked, never sent, always last when copied -->
	{#if spec.emailFooter.text !== ''}
		<div class="flex flex-col gap-1 rounded-md bg-surface p-4" data-section-footer={spec.key}>
			<p class="text-label font-semibold text-muted-foreground">{spec.emailFooter.label}</p>
			<p
				class="text-base leading-[1.6] [overflow-wrap:anywhere] whitespace-pre-wrap text-foreground"
			>
				{spec.emailFooter.text}
			</p>
		</div>
	{/if}

	<!-- 4. Character count -->
	{#if assembled}
		<div class="flex flex-col gap-1">
			<p class="text-label text-muted-foreground tabular-nums" data-card-count={spec.key}>
				{countLine(spec, assembled)}
			</p>
			{#if dropped}
				<p class="text-label text-muted-foreground">{dropped}</p>
			{/if}
		</div>
	{/if}

	<!-- 5. Edit post / Done editing -->
	{#if hasDraft && !streaming}
		<div>
			<Button bind:ref={editEl} variant="outline" onclick={toggleEdit} class="w-full sm:w-auto">
				{#if editing}
					<Check size={16} aria-hidden="true" />Done editing
				{:else}
					<Pencil size={16} aria-hidden="true" />Edit post
				{/if}
			</Button>
		</div>
	{/if}

	<!-- 6. Per-card findings -->
	{#if ready}
		<FindingsSummary
			{findings}
			idPrefix={base}
			headingLevel={4}
			{checkGroups}
			bind:acknowledged={
				() => acknowledged, (v: boolean) => (ackSig = v ? warnSignature(findings) : null)
			}
			{onApply}
			{onShow}
			onEdit={onEditFinding}
		/>
	{/if}

	<!-- 7. Exits: exactly one -->
	<div class="flex flex-col gap-2">
		<div role="group" aria-label={`Use the ${spec.label} post`} data-testid={`exits-${spec.key}`}>
			<Button
				variant="outline"
				aria-disabled={gated ? 'true' : undefined}
				aria-describedby={reason ? reasonId : statusLine ? statusId : undefined}
				onclick={onCopy}
				class="w-full sm:w-auto {GATED}"
				><Copy size={16} aria-hidden="true" />Copy {spec.label} post</Button
			>
		</div>
		{#if reason}
			<p
				id={reasonId}
				bind:this={reasonEl}
				tabindex="-1"
				class="flex items-start gap-2 text-label text-foreground"
			>
				{#if blockCount > 0}
					<CircleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0 text-destructive" />
				{:else}
					<TriangleAlert size={16} aria-hidden="true" class="mt-0.5 shrink-0" />
				{/if}
				{reason}
			</p>
		{/if}
		{#if statusLine}
			<p id={statusId} class="text-label text-muted-foreground">{statusLine}</p>
		{/if}
	</div>
</article>

<style>
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
