<script lang="ts" module>
	import { checkFairHousing, type Finding } from '@tran/core/fair-housing';

	/** Quiet time after the last keystroke before the input is checked (09-UI-SPEC). */
	export const INPUT_NOTE_DELAY_MS = 300;

	export interface NoteRow {
		id: string;
		text: string;
	}

	/**
	 * One note per finding, in the UI-SPEC input-note copy. The phrase is quoted exactly as the
	 * checker matched it; the short explanation is the lexicon entry's (the first member is the
	 * highest-severity entry for that span).
	 */
	export function noteRows(findings: readonly Finding[]): NoteRow[] {
		return findings.map((f) => {
			const explanation = f.members[0]?.explanation ?? '';
			return {
				id: f.id,
				text: `"${f.phrase}" may describe people rather than the home.${explanation ? ` ${explanation}` : ''} It will be flagged in the draft too.`
			};
		});
	}

	/** The Phase 5 Fair Housing checker run on user-typed text. */
	export function noteRowsFor(text: string): NoteRow[] {
		return noteRows(checkFairHousing(text));
	}
</script>

<script lang="ts">
	// 09-UI-SPEC "InputFairHousingNote": under any studio free-text input. Runs the Phase 5
	// Fair Housing checker 300 ms after typing stops. Warn-only: it never blocks typing or
	// generating. The input points at `id` with aria-describedby; the wrapper always renders so
	// that reference never dangles.
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let { text, id }: { text: string; id: string } = $props();

	let rows = $state<NoteRow[]>([]);

	$effect(() => {
		const value = text;
		const timer = setTimeout(() => {
			rows = noteRowsFor(value);
		}, INPUT_NOTE_DELAY_MS);
		return () => clearTimeout(timer);
	});
</script>

<div {id} data-input-fh-note>
	{#if rows.length > 0}
		<ul class="mt-2 flex flex-col gap-2">
			{#each rows as row (row.id)}
				<li class="flex items-start gap-2 text-label text-foreground">
					<TriangleAlert size={16} class="mt-0.5 shrink-0 text-foreground" aria-hidden="true" />
					<span>{row.text}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
