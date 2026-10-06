// Dedupe dry-run diff (AGT-03, AGT-07): classifies every incoming lead before anything is
// written. Shared by paste import, CSV import and quick-add. Pure: inputs are never mutated.
//
// Rules:
// - Tombstoned contacts (deletedAt set) never match.
// - Identity: Tran id, then normalized email, then normalized US phone. Un-normalizable phones
//   never match.
// - An import never overwrites a non-empty field. It fills blanks and lists every kept value.
// - Email matching contact A while phone matches contact B is a conflict (skipped by default).
// - Later rows sharing an email or phone with an earlier row merge into the earlier row.
import { isLive, type Contact, type IncomingLead } from '../agent/types.js';
import { cleanText, formatPhoneUS, normEmail, normPhoneUS } from './normalize.js';

export const FILLABLE_FIELDS = ['email', 'phone', 'propertyOfInterest', 'notes'] as const;
export type FillableField = (typeof FILLABLE_FIELDS)[number];

export interface TargetRef {
	id: string;
	name: string;
}

export interface KeptValue {
	field: FillableField;
	existing: string;
	incoming: string;
}

export type LeadDiffRow =
	| { kind: 'new'; lead: IncomingLead }
	| {
			kind: 'update';
			lead: IncomingLead;
			target: TargetRef;
			fills: FillableField[];
			keeps: KeptValue[];
			logsInquiry: boolean;
	  }
	| { kind: 'duplicate'; lead: IncomingLead; target: TargetRef }
	| { kind: 'conflict'; lead: IncomingLead; emailMatch: TargetRef; phoneMatch: TargetRef }
	| { kind: 'same-as-row'; lead: IncomingLead; firstRow: number };

export interface LeadDiff {
	rows: LeadDiffRow[];
	counts: { new: number; update: number; duplicate: number; conflict: number; sameAsRow: number };
}

const ref = (c: Contact): TargetRef => ({ id: c.id, name: c.name });

/** Identity key for a field: normalized email/phone, or null when it cannot be matched on. */
function keyOf(field: 'email' | 'phone', raw: string): string | null {
	return field === 'email' ? normEmail(raw) : normPhoneUS(raw);
}

/** Comparison value: identity key when there is one, otherwise the cleaned text. */
function compareValue(field: FillableField, raw: string): string {
	const clean = cleanText(raw);
	if (field === 'email' || field === 'phone') return keyOf(field, clean) ?? clean;
	return clean;
}

/** Display value for keeps: phones in national format, everything else cleaned. */
function displayValue(field: FillableField, raw: string): string {
	const clean = cleanText(raw);
	if (field === 'phone') {
		const e164 = normPhoneUS(clean);
		return e164 === null ? clean : formatPhoneUS(e164);
	}
	return clean;
}

const blank = (raw: string | undefined): boolean => cleanText(raw ?? '') === '';

/**
 * Fills blank text fields of `into` from `from` (in place on a private copy). Fields in `skip`
 * are left alone: their identity key already belongs to a different row of the batch.
 */
function mergeInto(into: IncomingLead, from: IncomingLead, skip: ReadonlySet<string>): void {
	for (const f of ['name', ...FILLABLE_FIELDS] as const) {
		if (!skip.has(f) && blank(into[f]) && !blank(from[f])) into[f] = from[f];
	}
	if (blank(into.message) && !blank(from.message) && from.message !== undefined) {
		into.message = from.message;
	}
}

export function diffLeads(
	incoming: readonly IncomingLead[],
	existing: readonly Contact[]
): LeadDiff {
	// Lookup maps over live contacts; the first contact wins a shared key.
	const byId = new Map<string, Contact>();
	const byEmail = new Map<string, Contact>();
	const byPhone = new Map<string, Contact>();
	for (const c of existing) {
		if (!isLive(c)) continue;
		if (!byId.has(c.id)) byId.set(c.id, c);
		const e = c.emailNorm ?? normEmail(c.email);
		if (e !== null && !byEmail.has(e)) byEmail.set(e, c);
		const p = c.phoneNorm ?? normPhoneUS(c.phone);
		if (p !== null && !byPhone.has(p)) byPhone.set(p, c);
	}

	// Pass 1: in-batch dedupe. Later rows merge into the first occurrence (copies only).
	const leads = incoming.map((l) => ({ ...l }));
	const firstOf: (number | null)[] = [];
	const batchEmail = new Map<string, number>();
	const batchPhone = new Map<string, number>();
	leads.forEach((l, i) => {
		const e = normEmail(l.email);
		const p = normPhoneUS(l.phone);
		const j =
			(e !== null ? batchEmail.get(e) : undefined) ?? (p !== null ? batchPhone.get(p) : undefined);
		const owner = j ?? i;
		firstOf.push(j ?? null);
		if (j !== undefined) {
			const first = leads[j];
			// Never copy an email/phone that another batch row owns: that would merge strangers.
			// Email is looked up first, so an owned email always resolves to j; only the phone can
			// belong to another row.
			const skip = new Set<string>();
			if (p !== null && (batchPhone.get(p) ?? j) !== j) skip.add('phone');
			if (first !== undefined) mergeInto(first, l, skip);
		}
		if (e !== null && !batchEmail.has(e)) batchEmail.set(e, owner);
		if (p !== null && !batchPhone.has(p)) batchPhone.set(p, owner);
	});

	// Pass 2: classify against existing contacts, in input order.
	const counts = { new: 0, update: 0, duplicate: 0, conflict: 0, sameAsRow: 0 };
	const rows: LeadDiffRow[] = leads.map((merged, i) => {
		const j = firstOf[i];
		if (j !== null && j !== undefined) {
			counts.sameAsRow += 1;
			return {
				kind: 'same-as-row',
				lead: incoming[i] as IncomingLead,
				firstRow: leads[j]?.rowNumber ?? 0
			};
		}
		const lead = merged;
		const e = normEmail(lead.email);
		const p = normPhoneUS(lead.phone);
		const idMatch = lead.id !== undefined ? byId.get(lead.id) : undefined;
		const emailMatch = e !== null ? byEmail.get(e) : undefined;
		const phoneMatch = p !== null ? byPhone.get(p) : undefined;

		let target: Contact | undefined = idMatch;
		if (target === undefined) {
			if (emailMatch !== undefined && phoneMatch !== undefined && emailMatch.id !== phoneMatch.id) {
				counts.conflict += 1;
				return { kind: 'conflict', lead, emailMatch: ref(emailMatch), phoneMatch: ref(phoneMatch) };
			}
			target = emailMatch ?? phoneMatch;
		}
		if (target === undefined) {
			counts.new += 1;
			return { kind: 'new', lead };
		}

		const collides: Record<'email' | 'phone', boolean> = {
			email: emailMatch !== undefined && emailMatch.id !== target.id,
			phone: phoneMatch !== undefined && phoneMatch.id !== target.id
		};
		const fills: FillableField[] = [];
		const keeps: KeptValue[] = [];
		for (const f of FILLABLE_FIELDS) {
			const have = target[f];
			const got = lead[f];
			if (blank(got)) continue;
			const collision = (f === 'email' || f === 'phone') && collides[f];
			if (blank(have) && !collision) {
				fills.push(f);
			} else if (collision || compareValue(f, have) !== compareValue(f, got)) {
				keeps.push({ field: f, existing: displayValue(f, have), incoming: displayValue(f, got) });
			}
		}
		const logsInquiry = !blank(lead.message);
		if (fills.length > 0 || logsInquiry) {
			counts.update += 1;
			return { kind: 'update', lead, target: ref(target), fills, keeps, logsInquiry };
		}
		counts.duplicate += 1;
		return { kind: 'duplicate', lead, target: ref(target) };
	});

	return { rows, counts };
}
