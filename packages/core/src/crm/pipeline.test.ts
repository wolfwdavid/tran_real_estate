import { describe, expect, it } from 'vitest';

import { STAGES, type Contact } from '../agent/types.js';
import { addDays, isIsoDate } from './dates.js';
import { applyMove, sortForBoard, stageCounts } from './pipeline.js';

const T0 = '2026-10-01T12:00:00.000Z';
let seq = 0;
function contact(overrides: Partial<Contact> = {}): Contact {
	seq += 1;
	return {
		id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
		ownerId: 'local',
		createdAt: T0,
		updatedAt: T0,
		schemaVersion: 1,
		name: `Contact ${seq}`,
		email: '',
		phone: '',
		stage: 'new',
		stageChangedAt: T0,
		source: 'manual',
		propertyOfInterest: '',
		notes: '',
		consentSource: 'unknown',
		emailOptOutAt: null,
		lastContactedAt: null,
		sample: false,
		...overrides
	};
}

describe('dates', () => {
	it('addDays crosses month, year, leap-day and DST boundaries', () => {
		expect(addDays('2026-10-04', 1)).toBe('2026-10-05');
		expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
		expect(addDays('2026-03-08', -7)).toBe('2026-03-01');
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
		expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
		expect(addDays('2026-11-01', 0)).toBe('2026-11-01');
		expect(addDays('2026-10-04', 7)).toBe('2026-10-11');
	});

	it('addDays rejects a malformed date', () => {
		expect(() => addDays('2026-10-4', 1)).toThrow();
	});

	it('isIsoDate accepts only real YYYY-MM-DD calendar dates', () => {
		expect(isIsoDate('2026-10-04')).toBe(true);
		expect(isIsoDate('2028-02-29')).toBe(true);
		expect(isIsoDate('2026-10-4')).toBe(false);
		expect(isIsoDate('2026-02-30')).toBe(false);
		expect(isIsoDate('2027-02-29')).toBe(false);
		expect(isIsoDate('2026-13-01')).toBe(false);
		expect(isIsoDate('2026-00-10')).toBe(false);
		expect(isIsoDate('2026-10-00')).toBe(false);
		expect(isIsoDate('2026-10-04T00:00:00Z')).toBe(false);
		expect(isIsoDate('')).toBe(false);
	});
});

describe('applyMove', () => {
	const now = '2026-10-04T15:00:00.000Z';

	it('moves the contact and logs exactly one stage_changed activity', () => {
		const c = contact({ stage: 'new', lastContactedAt: '2026-10-02T10:00:00.000Z' });
		const r = applyMove(c, 'touring', now);
		expect(r).not.toBeNull();
		expect(r!.contact).toEqual({ ...c, stage: 'touring', stageChangedAt: now, updatedAt: now });
		expect(r!.contact.lastContactedAt).toBe('2026-10-02T10:00:00.000Z');
		expect(r!.activity).toEqual({
			type: 'stage_changed',
			text: 'Moved from New to Touring',
			at: now,
			fromStage: 'new',
			toStage: 'touring',
			contactId: c.id,
			sample: false
		});
	});

	it('carries the sample flag onto the activity', () => {
		const c = contact({ stage: 'offer', sample: true });
		const r = applyMove(c, 'closed', now);
		expect(r!.activity.sample).toBe(true);
		expect(r!.activity.text).toBe('Moved from Offer to Closed');
	});

	it('moving backwards is allowed and logged', () => {
		const c = contact({ stage: 'offer' });
		const r = applyMove(c, 'contacted', now);
		expect(r!.activity.text).toBe('Moved from Offer to Contacted');
		expect(r!.contact.stage).toBe('contacted');
	});

	it('moving to the current stage is a no-op for every stage', () => {
		for (const s of STAGES) {
			expect(applyMove(contact({ stage: s }), s, now)).toBeNull();
		}
	});

	it('does not mutate the input', () => {
		const c = contact({ stage: 'new' });
		const snapshot = structuredClone(c);
		applyMove(c, 'contacted', now);
		expect(c).toEqual(snapshot);
	});
});

describe('stageCounts', () => {
	it('counts live contacts per stage, with zeros for empty stages', () => {
		const counts = stageCounts([
			contact({ stage: 'new' }),
			contact({ stage: 'new' }),
			contact({ stage: 'touring' }),
			contact({ stage: 'closed', deletedAt: '2026-10-03T00:00:00.000Z' })
		]);
		expect(counts).toEqual({ new: 2, contacted: 0, touring: 1, offer: 0, closed: 0 });
	});
});

describe('sortForBoard', () => {
	it('puts contacts with a next task first by due date, then the rest by last activity', () => {
		const a = contact({ name: 'A', updatedAt: '2026-10-01T00:00:00.000Z' });
		const b = contact({ name: 'B', updatedAt: '2026-10-03T00:00:00.000Z' });
		const c = contact({ name: 'C', lastContactedAt: '2026-10-04T00:00:00.000Z' });
		const d = contact({ name: 'D' });
		const e = contact({ name: 'E' });
		const nextDue = new Map([
			[d.id, '2026-10-09'],
			[e.id, '2026-10-05']
		]);
		const out = sortForBoard([a, b, c, d, e], nextDue);
		expect(out.map((x) => x.name)).toEqual(['E', 'D', 'C', 'B', 'A']);
	});

	it('breaks due-date ties by last activity desc, then by name', () => {
		const x = contact({ name: 'Xavier', updatedAt: '2026-10-01T00:00:00.000Z' });
		const y = contact({ name: 'Yara', updatedAt: '2026-10-02T00:00:00.000Z' });
		const z1 = contact({ name: 'Zed', updatedAt: '2026-10-02T00:00:00.000Z' });
		const al = contact({ name: 'Al', updatedAt: '2026-10-02T00:00:00.000Z' });
		const nextDue = new Map([
			[x.id, '2026-10-05'],
			[y.id, '2026-10-05'],
			[z1.id, '2026-10-05'],
			[al.id, '2026-10-05']
		]);
		expect(sortForBoard([x, z1, y, al], nextDue).map((c) => c.name)).toEqual([
			'Al',
			'Yara',
			'Zed',
			'Xavier'
		]);
	});

	it('prefers lastContactedAt over updatedAt for recency', () => {
		const p = contact({
			name: 'P',
			updatedAt: '2026-10-05T00:00:00.000Z',
			lastContactedAt: '2026-09-01T00:00:00.000Z'
		});
		const q = contact({ name: 'Q', updatedAt: '2026-10-01T00:00:00.000Z' });
		expect(sortForBoard([p, q], new Map()).map((c) => c.name)).toEqual(['Q', 'P']);
	});

	it('returns a new array and leaves the input order intact', () => {
		const list = [contact({ name: 'B' }), contact({ name: 'A' })];
		const out = sortForBoard(list, new Map());
		expect(out).not.toBe(list);
		expect(list.map((c) => c.name)).toEqual(['B', 'A']);
		expect(out.map((c) => c.name)).toEqual(['A', 'B']);
	});
});
