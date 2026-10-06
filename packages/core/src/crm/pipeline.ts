// Pipeline board logic (AGT-04): stage moves, per-column counts and card ordering.
// Pure functions; persistence and UI live in apps/web.
import {
	STAGE_LABELS,
	STAGES,
	isLive,
	type Activity,
	type Contact,
	type Stage
} from '../agent/types.js';

/** An activity before the Syncable fields are stamped by the repository. */
export type ActivityDraft = Omit<
	Activity,
	'id' | 'ownerId' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'schemaVersion'
>;

/**
 * Move a contact to another stage. Returns the updated contact plus exactly one
 * "Moved from {Old} to {New}" activity, or null when the contact is already in that stage.
 * A stage move is not contact, so lastContactedAt is left alone.
 */
export function applyMove(
	c: Contact,
	to: Stage,
	now: string
): { contact: Contact; activity: ActivityDraft } | null {
	if (c.stage === to) return null;
	return {
		contact: { ...c, stage: to, stageChangedAt: now, updatedAt: now },
		activity: {
			contactId: c.id,
			type: 'stage_changed',
			text: `Moved from ${STAGE_LABELS[c.stage]} to ${STAGE_LABELS[to]}`,
			at: now,
			fromStage: c.stage,
			toStage: to,
			sample: c.sample
		}
	};
}

/** Live contacts per stage; every stage is present (zero when empty). */
export function stageCounts(contacts: readonly Contact[]): Record<Stage, number> {
	const out = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
	for (const c of contacts) if (isLive(c)) out[c.stage] += 1;
	return out;
}

const recency = (c: Contact) => c.lastContactedAt ?? c.updatedAt;

/**
 * Board card order: contacts with a next open task first, by due date ascending; then contacts
 * without one. Ties: most recent activity (lastContactedAt, else updatedAt) first, then name.
 * `nextDue` maps contactId to the YYYY-MM-DD due date of that contact's next open task.
 */
export function sortForBoard(
	contacts: readonly Contact[],
	nextDue: ReadonlyMap<string, string>
): Contact[] {
	return [...contacts].sort((a, b) => {
		const da = nextDue.get(a.id);
		const db = nextDue.get(b.id);
		if (da !== undefined && db === undefined) return -1;
		if (da === undefined && db !== undefined) return 1;
		if (da !== undefined && db !== undefined && da !== db) return da < db ? -1 : 1;
		const ra = recency(a);
		const rb = recency(b);
		if (ra !== rb) return ra > rb ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
}
