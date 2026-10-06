// Analyzer working draft (07-12, 07-UI-SPEC "Working draft autosave"). One investorDraft row holds
// the analyzer's current inputs so a reload or an accidental navigation never loses typing. It is
// separate from saved deals and is registered in backup (07-09 tables.ts).
//
// The row is a Phase 3 Syncable record because the backup envelope validates every row that way:
// a fixed uuid-shaped id (not the literal 'current', which would fail the backup's uuid check),
// ownerId 'local', ISO timestamps, deletedAt omitted. Callers pass plain data (`$state.snapshot`),
// never a Svelte proxy: IndexedDB structured-clones the value.
import { newSyncable, type Syncable } from '@tran/core';
import { getDb, type TranDb } from '$lib/storage/db';
import type { DealSources } from '../deals/schema';
import { INVESTOR_RECORD_SCHEMA_VERSION } from '../deals/tables';
import { defaultForm, type AnalyzerForm } from './form-model';

/** The single draft row's id (uuid v4 shaped, the same in every browser). */
export const DRAFT_ID = '00000000-0000-4000-8000-00000000d4af';

export interface AnalyzerDraft {
	id: typeof DRAFT_ID;
	/** The saved deal this draft edits, or null for a new analysis. */
	dealId: string | null;
	form: AnalyzerForm;
	sources: DealSources;
	estimates?: { rent?: unknown; value?: unknown };
	/** dealSnapshot() captured at save/open; null when nothing has been saved. */
	savedSnapshot: string | null;
	/** ISO timestamp of the last write. */
	updatedAt: string;
}

export type DraftInput = Omit<AnalyzerDraft, 'id' | 'updatedAt'>;

type DraftRow = Syncable & Omit<AnalyzerDraft, 'id' | 'updatedAt'>;

export interface DraftRepo {
	readDraft(): Promise<AnalyzerDraft | null>;
	writeDraft(d: DraftInput): Promise<void>;
	clearDraft(): Promise<void>;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** Missing keys (an older or hand-edited row) fall back to the defaults; a non-object is no draft. */
function restoreForm(v: unknown): AnalyzerForm | null {
	if (!isObject(v)) return null;
	const form = { ...defaultForm(), ...v } as AnalyzerForm;
	return Array.isArray(form.expenses) ? form : null;
}

export function createDraftRepo(db: TranDb, o: { now?: () => Date } = {}): DraftRepo {
	const now = o.now ?? (() => new Date());
	const table = () => db.investorDraft;

	return {
		async readDraft() {
			const row = (await table().get(DRAFT_ID)) as Partial<DraftRow> | undefined;
			if (!row || row.deletedAt !== undefined) return null;
			const form = restoreForm(row.form);
			if (!form) return null;
			const draft: AnalyzerDraft = {
				id: DRAFT_ID,
				dealId: typeof row.dealId === 'string' ? row.dealId : null,
				form,
				sources: isObject(row.sources) ? (row.sources as DealSources) : {},
				savedSnapshot: typeof row.savedSnapshot === 'string' ? row.savedSnapshot : null,
				updatedAt: row.updatedAt ?? ''
			};
			if (isObject(row.estimates)) draft.estimates = row.estimates;
			return draft;
		},

		writeDraft(d) {
			return db.transaction('rw', table(), async () => {
				const at = now();
				const existing = await table().get(DRAFT_ID);
				const fresh = newSyncable({
					id: DRAFT_ID,
					now: at,
					schemaVersion: INVESTOR_RECORD_SCHEMA_VERSION
				});
				// A rewrite keeps the original createdAt; updatedAt moves.
				const base = existing ? { ...fresh, createdAt: existing.createdAt } : fresh;
				const row: DraftRow = {
					...base,
					dealId: d.dealId,
					form: d.form,
					sources: d.sources,
					savedSnapshot: d.savedSnapshot
				};
				if (d.estimates !== undefined) row.estimates = d.estimates;
				await table().put(row);
			});
		},

		async clearDraft() {
			await table().delete(DRAFT_ID);
		}
	};
}

let instance: DraftRepo | undefined;
const repo = () => (instance ??= createDraftRepo(getDb()));

/** App-database draft functions. Call from onMount / event handlers / the autosave effect only. */
export const readDraft = () => repo().readDraft();
export const writeDraft = (d: DraftInput) => repo().writeDraft(d);
export const clearDraft = () => repo().clearDraft();

export interface AutosaverOptions {
	delayMs?: number;
	setTimer?: typeof setTimeout;
	clearTimer?: typeof clearTimeout;
	/** A failed write is reported here (the next change retries); never thrown into the effect. */
	onError?: (error: unknown) => void;
}

export interface Autosaver {
	/** Write `d` once no further schedule() arrives for `delayMs` (500ms): only the last one lands. */
	schedule(d: DraftInput): void;
	/** Write the pending draft now (page hide, before navigation). */
	flush(): Promise<void>;
	/** Drop the pending draft (Clear analysis). */
	cancel(): void;
}

export function createAutosaver(
	write: (d: DraftInput) => Promise<void>,
	opts: AutosaverOptions = {}
): Autosaver {
	const delay = opts.delayMs ?? 500;
	const setTimer = opts.setTimer ?? setTimeout;
	const clearTimer = opts.clearTimer ?? clearTimeout;
	let pending: DraftInput | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const stop = () => {
		if (timer !== null) clearTimer(timer);
		timer = null;
	};

	const run = async () => {
		stop();
		const d = pending;
		pending = null;
		if (!d) return;
		try {
			await write(d);
		} catch (error) {
			opts.onError?.(error);
		}
	};

	return {
		schedule(d) {
			pending = d;
			stop();
			timer = setTimer(() => void run(), delay);
		},
		flush: run,
		cancel() {
			stop();
			pending = null;
		}
	};
}
