// Tests for the launch-audit generator (10-22). Part 1: the PITFALLS "Looks Done But Isn't"
// checklist is parsed from the real research file and every item must have declared evidence.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { HUMAN_UAT, PITFALLS_EVIDENCE } from './lib/pitfalls-evidence.mjs';
import {
	evidenceMapErrors,
	parsePitfallsChecklist,
	pitfallLabel,
	uncoveredPitfalls
} from './launch-audit.mjs';

const ROOT = join(import.meta.dirname, '..');
const PITFALLS_MD = readFileSync(join(ROOT, '.planning/research/PITFALLS.md'), 'utf8');

/** The `- [ ]` lines of the checklist section, counted independently of the parser. */
function checklistSection(md: string): string {
	const start = md.indexOf(`## "Looks Done But Isn't" Checklist`);
	const rest = md.slice(start + 3);
	const end = rest.search(/^## /m);
	return end === -1 ? rest : rest.slice(0, end);
}

describe('parsePitfallsChecklist', () => {
	const items = parsePitfallsChecklist(PITFALLS_MD);

	test('returns every checklist line of the section verbatim (>= 16)', () => {
		const lines = checklistSection(PITFALLS_MD)
			.split(/\r?\n/)
			.filter((l) => l.startsWith('- [ ] '))
			.map((l) => l.slice(6));
		expect(lines.length).toBeGreaterThanOrEqual(16);
		expect(items).toEqual(lines);
	});

	test('takes nothing from other sections', () => {
		const md =
			'## Other\n\n- [ ] **Elsewhere:** no\n\n' +
			`## "Looks Done But Isn't" Checklist\n\n- [ ] **A:** one\n- [ ] **B:** two\n\n` +
			'## Recovery Strategies\n\n- [ ] **After:** no\n';
		expect(parsePitfallsChecklist(md)).toEqual(['**A:** one', '**B:** two']);
	});

	test('throws when the section heading is missing (never an empty pass)', () => {
		expect(() => parsePitfallsChecklist('# nothing here')).toThrow(/Looks Done/);
	});

	test('pitfallLabel extracts the bold label', () => {
		expect(pitfallLabel('**RentCast client:** Often missing budget')).toBe('RentCast client');
		expect(pitfallLabel('no label here')).toBeNull();
	});
});

describe('PITFALLS_EVIDENCE coverage', () => {
	const items = parsePitfallsChecklist(PITFALLS_MD);

	test('every parsed label has an entry and no entry is stale', () => {
		expect(uncoveredPitfalls(items, PITFALLS_EVIDENCE)).toEqual({ missing: [], stale: [] });
	});

	test('names the required labels', () => {
		for (const k of ['RentCast client', 'Disclaimers', 'Extension', 'Secrets', 'Lead form']) {
			expect(PITFALLS_EVIDENCE).toHaveProperty([k]);
		}
	});

	test('every entry is well formed and every human step resolves to a Human UAT row', () => {
		expect(evidenceMapErrors(PITFALLS_EVIDENCE, HUMAN_UAT)).toEqual([]);
	});

	test('non-vacuity: a new checklist line without evidence is reported', () => {
		const more = [...items, '**Brand new:** x'];
		expect(uncoveredPitfalls(more, PITFALLS_EVIDENCE).missing).toEqual(['Brand new']);
	});

	test('non-vacuity: a stale map entry is reported', () => {
		const map = { ...PITFALLS_EVIDENCE, Gone: { kind: 'na', reason: 'x' } };
		expect(uncoveredPitfalls(items, map).stale).toEqual(['Gone']);
	});

	test('non-vacuity: malformed entries are reported', () => {
		const bad = {
			A: { kind: 'auto', evidence: [] },
			B: { kind: 'na' },
			C: { kind: 'human', reason: 'r', human: 'no-such-step' },
			D: { kind: 'auto', evidence: [{ type: 'smoke', match: 'x' }] },
			E: { kind: 'maybe', reason: 'r' }
		};
		const errors = evidenceMapErrors(bad, HUMAN_UAT);
		for (const k of ['A', 'B', 'C', 'D', 'E']) {
			expect(errors.some((e: string) => e.startsWith(`${k}:`))).toBe(true);
		}
	});
});
