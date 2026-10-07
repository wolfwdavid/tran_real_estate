// Studio working forms (STU-01, 09-UI-SPEC "StudioWorkingDraft"): one studioDraft row per tool,
// keyed by the tool. Each row is a Syncable record with that tool's fixed uuid id, so the backup
// ("Studio forms") accepts it and a merge updates the same row in every browser.
//
// Callers pass plain data (`$state.snapshot(form)`), never a Svelte proxy: IndexedDB
// structured-clones the value. The autosave helper (autosave.svelte.ts) snapshots for its callers.
// Browser callers only (onMount / event handlers / the autosave timer).
import { newSyncable } from '@tran/core';
import { getDb } from '$lib/storage/db';
import {
	STUDIO_DRAFT_IDS,
	STUDIO_RECORD_SCHEMA_VERSION,
	studioDraftTable,
	type StudioDraftRow
} from './tables';
import { STUDIO_TOOLS, type StudioDraftRecord, type StudioTool } from './types';

function assertTool(tool: StudioTool): void {
	if (!STUDIO_TOOLS.includes(tool)) throw new Error('studio-tool-invalid');
}

/** The tool's saved form, or null when none is stored. */
export async function getStudioDraft(tool: StudioTool): Promise<StudioDraftRecord | null> {
	assertTool(tool);
	const row = await studioDraftTable(getDb()).get(tool);
	if (!row || row.deletedAt !== undefined) return null;
	return { tool: row.tool, data: row.data, updatedAt: row.updatedAt };
}

/** Writes (or rewrites) the tool's form. A rewrite keeps the original createdAt. */
export async function putStudioDraft(
	tool: StudioTool,
	data: unknown,
	o: { now?: Date } = {}
): Promise<StudioDraftRecord> {
	assertTool(tool);
	const db = getDb();
	const table = studioDraftTable(db);
	const at = o.now ?? new Date();
	return db.transaction('rw', table, async () => {
		const existing = await table.get(tool);
		const fresh = newSyncable({
			id: STUDIO_DRAFT_IDS[tool],
			now: at,
			schemaVersion: STUDIO_RECORD_SCHEMA_VERSION
		});
		const row: StudioDraftRow = {
			...(existing ? { ...fresh, createdAt: existing.createdAt } : fresh),
			tool,
			data
		};
		await table.put(row);
		return { tool, data, updatedAt: row.updatedAt };
	});
}

/** Removes one tool's form; every other tool's form is untouched. */
export async function clearStudioDraft(tool: StudioTool): Promise<void> {
	assertTool(tool);
	await studioDraftTable(getDb()).delete(tool);
}
