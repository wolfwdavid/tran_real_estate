<script lang="ts" module>
	import {
		CAPTION_LINE_MAX,
		formatTime,
		parseReel,
		timeBeats,
		type ReelLength,
		type TimedBeat
	} from '@tran/core/studio';

	export const AT_A_GLANCE_EMPTY = 'The beat table appears here once a script is written.';
	export const PARSE_TITLE = "Tran couldn't split this script into beats";
	export const PARSE_BODY =
		'The script is still above, and you can copy it as is. To see the table, generate again, or edit the draft so each beat starts with its name on its own line, like HOOK.';
	export const PLACEHOLDER_NOTE = 'Replace this with a real result before you record.';
	export const CAPTION_NOTE = `This caption line has more than ${CAPTION_LINE_MAX} characters, which can be hard to read on a phone.`;

	export function overrunNote(seconds: number): string {
		const s = Math.max(1, Math.round(seconds));
		return `The voiceover runs about ${s} ${s === 1 ? 'second' : 'seconds'} long for this beat. Trim a few words.`;
	}

	/** Row notes for one beat, in display order. Notes inform; they never gate. */
	export function beatNotes(t: TimedBeat): string[] {
		const notes: string[] = [];
		if (t.isPlaceholder) notes.push(PLACEHOLDER_NOTE);
		if (t.overrunSeconds !== null) notes.push(overrunNote(t.overrunSeconds));
		if (t.longCaptionLines.length > 0) notes.push(CAPTION_NOTE);
		return notes;
	}

	export type ScriptView =
		| { kind: 'empty' }
		| { kind: 'unparsed' }
		| { kind: 'beats'; beats: TimedBeat[]; shots: string[] };

	/**
	 * The view of the current draft text: times come only from REEL_TEMPLATES[length]. While the run
	 * is still streaming, partial text that does not parse yet is not a parse failure: the view stays
	 * on the empty line until the stream ends (or the text parses), so the "couldn't split" panel
	 * only ever describes a finished draft.
	 */
	export function scriptView(draft: string, length: ReelLength, streaming = false): ScriptView {
		if (draft.trim() === '') return { kind: 'empty' };
		const parsed = parseReel(draft);
		if (!parsed.ok) return streaming ? { kind: 'empty' } : { kind: 'unparsed' };
		const beats = timeBeats(parsed.beats, length);
		const shots = beats
			.filter((b) => b.broll !== '')
			.map((b) => `${formatTime(b.startSec)} ${b.broll}`);
		return { kind: 'beats', beats, shots };
	}
</script>

<script lang="ts">
	// 09-UI-SPEC "ReelScriptView anatomy" (STU-03): a read-only view derived from the panel's
	// current draft text, edits included. Not an exit. From 1024px a real <table> in a focusable
	// scroll wrapper; below 1024px an <ol> of beat cards. The swap is CSS only (display: none), so
	// exactly one variant is in the accessibility tree at a time. Never announced.
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let {
		draft,
		length,
		streaming = false
	}: {
		draft: string;
		length: ReelLength;
		/** True while the panel's run is connecting or streaming (GenerationPanel bind:running). */
		streaming?: boolean;
	} = $props();

	const view = $derived(scriptView(draft, length, streaming));
	const caption = $derived(
		view.kind === 'beats' ? `${length}-second reel, ${view.beats.length} beats` : ''
	);
	const helper = $derived(
		`Built from the draft above, including your edits. Times are set by Tran for a ${length}-second reel.`
	);

	const cell = 'border-t border-border px-4 py-2 align-top text-base leading-[1.6] text-foreground';
	const noteCls = 'flex items-start gap-2 text-label text-foreground';
	const termCls = 'text-label font-semibold text-muted-foreground';
	const valueCls = 'text-base leading-[1.6] text-foreground [overflow-wrap:anywhere]';
</script>

{#snippet notes(t: TimedBeat)}
	{@const rows = beatNotes(t)}
	{#if rows.length > 0}
		<ul class="mt-2 flex flex-col gap-1">
			{#each rows as note (note)}
				<li class={noteCls}>
					<TriangleAlert size={16} class="mt-0.5 shrink-0 text-foreground" aria-hidden="true" />
					<span>{note}</span>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet text(value: string, strong: boolean)}
	<span class={strong ? 'font-semibold' : undefined}>{value}</span>
{/snippet}

<section aria-labelledby="reel-glance-heading" class="flex min-w-0 flex-col gap-4" data-reel-view>
	<h2 id="reel-glance-heading" class="font-display text-heading font-semibold text-foreground">
		Script at a glance
	</h2>

	{#if view.kind === 'empty'}
		<p class="text-label text-muted-foreground" data-reel-view-state="empty">{AT_A_GLANCE_EMPTY}</p>
	{:else if view.kind === 'unparsed'}
		<div
			class="flex items-start gap-3 rounded-lg border border-border bg-surface p-4"
			data-reel-view-state="unparsed"
		>
			<SearchX size={20} class="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<div class="flex min-w-0 flex-col gap-1">
				<h3 class="text-base leading-[1.6] font-semibold text-foreground">{PARSE_TITLE}</h3>
				<p class="text-base leading-[1.6] text-foreground">{PARSE_BODY}</p>
			</div>
		</div>
	{:else}
		<p class="text-label text-muted-foreground">{helper}</p>

		<!-- From 1024px: the table. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="hidden max-w-full overflow-x-auto rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:block"
			tabindex="0"
			role="region"
			aria-label={caption}
			data-reel-table
		>
			<table class="w-full border-collapse text-left">
				<caption class="px-4 py-2 text-left text-label text-muted-foreground">{caption}</caption>
				<thead class="bg-surface">
					<tr>
						<th scope="col" class="px-4 py-2 text-label font-semibold text-foreground">Time</th>
						<th scope="col" class="px-4 py-2 text-label font-semibold text-foreground">Beat</th>
						<th scope="col" class="px-4 py-2 text-label font-semibold text-foreground">Voiceover</th
						>
						<th scope="col" class="px-4 py-2 text-label font-semibold text-foreground"
							>On-screen caption</th
						>
						<th scope="col" class="px-4 py-2 text-label font-semibold text-foreground">B-roll</th>
					</tr>
				</thead>
				<tbody>
					{#each view.beats as t (t.key)}
						<tr data-beat={t.key}>
							<td class="{cell} whitespace-nowrap tabular-nums">{t.slot}</td>
							<th scope="row" class="{cell} font-semibold">{t.name}</th>
							<td class={cell}>
								{@render text(t.voiceover, t.isPlaceholder)}
								{@render notes(t)}
							</td>
							<td class={cell}>{@render text(t.caption, t.isPlaceholder)}</td>
							<td class={cell}>{t.broll}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Below 1024px: stacked beat cards. -->
		<ol class="flex flex-col gap-2 lg:hidden" data-reel-cards>
			{#each view.beats as t (t.key)}
				<li class="rounded-lg border border-border bg-card p-4" data-beat={t.key}>
					<h3 class="text-base leading-[1.6] font-semibold text-foreground">
						{t.name} · <span class="tabular-nums">{t.slot}</span>
					</h3>
					<dl class="mt-2 flex flex-col gap-2">
						<div>
							<dt class={termCls}>Voiceover</dt>
							<dd class={valueCls}>{@render text(t.voiceover, t.isPlaceholder)}</dd>
						</div>
						<div>
							<dt class={termCls}>On-screen caption</dt>
							<dd class={valueCls}>{@render text(t.caption, t.isPlaceholder)}</dd>
						</div>
						<div>
							<dt class={termCls}>B-roll</dt>
							<dd class={valueCls}>{t.broll}</dd>
						</div>
					</dl>
					{@render notes(t)}
				</li>
			{/each}
		</ol>

		<div class="flex flex-col gap-2">
			<h3 class="text-base leading-[1.6] font-semibold text-foreground">B-roll shot list</h3>
			<ol class="flex list-decimal flex-col gap-1 pl-6" data-reel-shots>
				{#each view.shots as shot, i (i)}
					<li class="text-base leading-[1.6] text-foreground tabular-nums">{shot}</li>
				{/each}
			</ol>
		</div>
	{/if}
</section>
