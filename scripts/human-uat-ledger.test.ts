// Text oracle for .planning/HUMAN-UAT.md (13-05, LIVE-07): the one ledger that replaced the twelve
// per-phase ??-HUMAN-UAT.md files. The ledger must hold every origin row exactly once, so this file
// derives the origin ids from the per-phase files with the counting rule below and fails if any id is
// missing, duplicated or misclassified in the ledger.
//
// Counting rule (13-RESEARCH "HUMAN-UAT enumeration"):
//   - a file with id-table rows (`| U1 |`, `| H1 |`, `| R1 |`, `| I1 |`/`| S1 |`) contributes one row
//     per table id; its `### A.`-style headings are step recipes, not rows;
//   - every other file contributes one row per `### N. Title` or `### UAT-N. Title` heading under
//     `## Tests` (up to the next `## ` heading).
//   Origin id = `<two-digit phase>-<row id>` (01-1, 04-U1, 08-UAT-1, ...). Total: 99.
//
// Where the files live: GSD archives completed milestones under .planning/milestones/** and may move
// phase directories there, so the per-phase files are searched under .planning/phases/*/ AND
// .planning/milestones/**. Each phase 01..12 must be found exactly once; the per-file counts in
// EXPECTED_COUNTS are the recorded truth if a file moves.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const LEDGER_PATH = join(ROOT, '.planning/HUMAN-UAT.md');

/** Rows each per-phase file contributes under the counting rule (sum 99). */
export const EXPECTED_COUNTS: Readonly<Record<string, number>> = Object.freeze({
	'01': 3,
	'02': 3,
	'03': 9,
	'04': 14,
	'05': 10,
	'06': 12,
	'07': 15,
	'08': 7,
	'09': 8,
	'10': 8,
	'11': 8,
	'12': 2
});
export const PHASES = Object.keys(EXPECTED_COUNTS);
export const TOTAL_ROWS = 99;

export const CLASSES = ['smoke', 'human', 'owner-decision', 'cut'] as const;
export const RESULT_PREFIXES = [
	'pending',
	'passed',
	'failed',
	'carried',
	'decided',
	'cut',
	'not applicable'
] as const;

export interface LedgerRow {
	id: string;
	origin: string;
	title: string;
	cls: string;
	result: string;
	evidence: string;
}

function normalize(text: string): string {
	return text.replace(/\r\n/g, '\n');
}

/** Origin ids a per-phase file contributes, in file order, prefixed `${phase}-`. */
export function parseOriginIds(phase: string, text: string): string[] {
	const src = normalize(text);
	const tableIds = [...src.matchAll(/^\| *([A-Z]\d+) *\|/gm)].map((m) => m[1]);
	if (tableIds.length > 0) return tableIds.map((id) => `${phase}-${id}`);
	const start = src.indexOf('\n## Tests');
	if (start === -1) return [];
	const afterHeading = src.indexOf('\n', start + 1);
	const next = src.indexOf('\n## ', afterHeading);
	const section = src.slice(afterHeading, next === -1 ? undefined : next);
	return [...section.matchAll(/^### (UAT-\d+|\d+)\. /gm)].map((m) => `${phase}-${m[1]}`);
}

/** Ledger rows: `| L01 | origin | title | class | result | evidence |` or `| P13-n | ... |`. */
export function parseLedger(text: string): LedgerRow[] {
	const re = /^\| (L\d{2}|P13-\d+) \| ([^|]*) \| ([^|]*) \| ([^|]*) \| ([^|]*) \| ([^|]*) \|$/gm;
	return [...normalize(text).matchAll(re)].map((m) => ({
		id: m[1],
		origin: m[2].trim(),
		title: m[3].trim(),
		cls: m[4].trim(),
		result: m[5].trim(),
		evidence: m[6].trim()
	}));
}

function isEmptyEvidence(evidence: string): boolean {
	return evidence === '' || evidence === '—' || evidence === '-';
}

/** Every rule the ledger must satisfy, as human-readable problems (empty when the ledger is sound). */
export function ledgerProblems(rows: LedgerRow[], originIds: string[]): string[] {
	const problems: string[] = [];

	// L ids contiguous and unique.
	const lIds = rows.filter((r) => r.id.startsWith('L')).map((r) => r.id);
	const seenL = new Set<string>();
	for (const id of lIds) {
		if (seenL.has(id)) problems.push(`duplicate ledger id ${id}`);
		seenL.add(id);
	}
	const expectedL = Array.from(
		{ length: seenL.size },
		(_, i) => `L${String(i + 1).padStart(2, '0')}`
	);
	for (const id of expectedL)
		if (!seenL.has(id)) problems.push(`missing ledger id ${id} (ids not contiguous)`);
	for (const id of seenL)
		if (!expectedL.includes(id)) problems.push(`ledger id ${id} out of range`);

	// P13 rows carry Origin "Phase 13"; L rows carry a known origin id exactly once.
	const originCount = new Map<string, number>();
	for (const r of rows) {
		if (r.id.startsWith('P13-')) {
			if (r.origin !== 'Phase 13')
				problems.push(`${r.id}: origin must be "Phase 13", got "${r.origin}"`);
			continue;
		}
		if (!originIds.includes(r.origin)) problems.push(`${r.id}: unknown origin "${r.origin}"`);
		originCount.set(r.origin, (originCount.get(r.origin) ?? 0) + 1);
	}
	for (const id of originIds) {
		const n = originCount.get(id) ?? 0;
		if (n === 0) problems.push(`origin ${id} missing from the ledger`);
		if (n > 1) problems.push(`origin ${id} appears ${n} times in the ledger`);
	}

	// Class, result and evidence rules.
	for (const r of rows) {
		if (r.title === '') problems.push(`${r.id}: empty title`);
		const parts = r.cls.split(' + ');
		if (r.cls === '' || parts.some((p) => !(CLASSES as readonly string[]).includes(p))) {
			problems.push(`${r.id}: bad class "${r.cls}"`);
		}
		if (!RESULT_PREFIXES.some((p) => r.result.startsWith(p))) {
			problems.push(`${r.id}: bad result "${r.result}"`);
		}
		const passed = r.result.startsWith('passed');
		if (passed && isEmptyEvidence(r.evidence)) problems.push(`${r.id}: passed without evidence`);
		if (passed && parts.includes('smoke') && !r.evidence.includes('/actions/runs/')) {
			problems.push(`${r.id}: smoke row passed without a live-smoke run link`);
		}
	}
	return problems;
}

function walk(dir: string, out: string[]): void {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return;
	}
	for (const name of entries) {
		if (name === 'node_modules') continue;
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/^\d{2}-HUMAN-UAT\.md$/.test(name)) out.push(p);
	}
}

/** `??-HUMAN-UAT.md` files under .planning/phases/*\/ and .planning/milestones/**, keyed by phase. */
export function findUatFiles(repoRoot: string): Map<string, string[]> {
	const found: string[] = [];
	const phasesDir = join(repoRoot, '.planning/phases');
	let phaseDirs: string[];
	try {
		phaseDirs = readdirSync(phasesDir);
	} catch {
		phaseDirs = [];
	}
	for (const d of phaseDirs) {
		const p = join(phasesDir, d);
		if (!statSync(p).isDirectory()) continue;
		for (const name of readdirSync(p)) {
			if (/^\d{2}-HUMAN-UAT\.md$/.test(name)) found.push(join(p, name));
		}
	}
	walk(join(repoRoot, '.planning/milestones'), found);
	const byPhase = new Map<string, string[]>();
	for (const f of found) {
		const phase = f.slice(-'NN-HUMAN-UAT.md'.length, -'-HUMAN-UAT.md'.length);
		byPhase.set(phase, [...(byPhase.get(phase) ?? []), f]);
	}
	return byPhase;
}

/** The YAML frontmatter block (between the opening and closing `---`), or '' when absent. */
export function frontmatter(text: string): string {
	const src = normalize(text);
	if (!src.startsWith('---\n')) return '';
	const end = src.indexOf('\n---', 4);
	return end === -1 ? '' : src.slice(4, end + 1);
}

const files = findUatFiles(ROOT);
const uatTexts = new Map<string, string>();
for (const phase of PHASES) {
	const paths = files.get(phase) ?? [];
	if (paths.length === 1) uatTexts.set(phase, readFileSync(paths[0], 'utf8'));
}
const originIds = PHASES.flatMap((phase) => parseOriginIds(phase, uatTexts.get(phase) ?? ''));

function readLedger(): string {
	return normalize(readFileSync(LEDGER_PATH, 'utf8'));
}

describe('counting rule parser', () => {
	test('table-id files count ids, not recipe headings', () => {
		const text = [
			'## Tests',
			'',
			'| Id | Check |',
			'|----|-------|',
			'| U1 | a |',
			'| U2 | b |',
			'',
			'### A. Steps (U1)',
			'### B. More (U2)'
		].join('\n');
		expect(parseOriginIds('04', text)).toEqual(['04-U1', '04-U2']);
	});

	test('heading files count numbered headings under ## Tests only', () => {
		const text = [
			'## Current Test',
			'',
			'### 9. not a row',
			'',
			'## Tests',
			'',
			'### 1. First',
			'body',
			'### UAT-2. Second',
			'',
			'## Summary',
			'',
			'### 3. not a row'
		].join('\n');
		expect(parseOriginIds('08', text)).toEqual(['08-1', '08-UAT-2']);
	});
});

describe('per-phase files', () => {
	test('phases 01..12 are each found exactly once under .planning/phases or .planning/milestones', () => {
		const counts = Object.fromEntries(PHASES.map((p) => [p, (files.get(p) ?? []).length]));
		expect(counts).toEqual(Object.fromEntries(PHASES.map((p) => [p, 1])));
	});

	test('the counting rule yields the recorded per-file counts and 99 ids', () => {
		const counts = Object.fromEntries(
			PHASES.map((p) => [p, parseOriginIds(p, uatTexts.get(p) ?? '').length])
		);
		expect(counts).toEqual(EXPECTED_COUNTS);
		expect(originIds).toHaveLength(TOTAL_ROWS);
		expect(new Set(originIds).size).toBe(TOTAL_ROWS);
	});
});

describe('ledger', () => {
	test('holds every origin id once, contiguous L ids, valid classes, results and evidence', () => {
		const rows = parseLedger(readLedger());
		expect(rows.length).toBeGreaterThanOrEqual(TOTAL_ROWS);
		expect(ledgerProblems(rows, originIds)).toEqual([]);
	});

	test('has 99 L rows and at least the four Phase 13 rows', () => {
		const rows = parseLedger(readLedger());
		expect(rows.filter((r) => r.id.startsWith('L'))).toHaveLength(TOTAL_ROWS);
		expect(rows.filter((r) => r.id.startsWith('P13-')).length).toBeGreaterThanOrEqual(4);
	});

	test('header states the counting rule, the real count and the 77 miscount', () => {
		const ledger = readLedger();
		expect(ledger).toMatch(/^## Counting rule$/m);
		expect(ledger).toMatch(/99 rows/);
		expect(ledger).toMatch(/77/);
		expect(ledger).toMatch(/scripts\/human-uat-ledger\.test\.ts/);
	});
});

describe('planted ledger defects are caught', () => {
	function rowLine(ledger: string, id: string): string {
		const line = ledger.split('\n').find((l) => l.startsWith(`| ${id} |`));
		if (!line) throw new Error(`no row ${id}`);
		return line;
	}

	test('a removed origin row fails the completeness check', () => {
		const ledger = readLedger();
		const line = rowLine(ledger, 'L42');
		const mutated = ledger.replace(`${line}\n`, '');
		const problems = ledgerProblems(parseLedger(mutated), originIds);
		expect(problems).toEqual(
			expect.arrayContaining([expect.stringMatching(/^origin 06-R3 missing/)])
		);
		expect(problems).toEqual(
			expect.arrayContaining([expect.stringMatching(/^missing ledger id L42/)])
		);
	});

	test('a duplicated origin fails', () => {
		const ledger = readLedger();
		const line = rowLine(ledger, 'L07');
		const mutated = ledger.replace(`${line}\n`, `${line}\n${line}\n`);
		const problems = ledgerProblems(parseLedger(mutated), originIds);
		expect(problems).toEqual(
			expect.arrayContaining([expect.stringMatching(/^origin 03-1 appears 2 times/)])
		);
	});

	test('class "maybe" fails', () => {
		const ledger = readLedger();
		const line = rowLine(ledger, 'L50');
		const cells = line.split(' | ');
		cells[3] = 'maybe';
		const mutated = ledger.replace(line, cells.join(' | '));
		const problems = ledgerProblems(parseLedger(mutated), originIds);
		expect(problems).toEqual(['L50: bad class "maybe"']);
	});

	test('a passed smoke row without a run link fails', () => {
		const rows = parseLedger(readLedger()).map((r) =>
			r.id === 'L01' ? { ...r, result: 'passed 2026-10-30', evidence: 'looked fine' } : r
		);
		expect(ledgerProblems(rows, originIds)).toEqual([
			'L01: smoke row passed without a live-smoke run link'
		]);
	});

	test('a passed row with an empty evidence cell fails', () => {
		const rows = parseLedger(readLedger()).map((r) =>
			r.id === 'L04' ? { ...r, result: 'passed 2026-10-30', evidence: '—' } : r
		);
		expect(ledgerProblems(rows, originIds)).toEqual(['L04: passed without evidence']);
	});
});

describe('per-phase files are superseded by the ledger', () => {
	test.each(PHASES)(
		'phase %s frontmatter says status: superseded and points to the ledger',
		(phase) => {
			const text = uatTexts.get(phase) ?? '';
			expect(frontmatter(text)).toMatch(/^status: superseded$/m);
			expect(frontmatter(text)).toMatch(/^superseded_by: \.planning\/HUMAN-UAT\.md$/m);
			expect(text).toContain('.planning/HUMAN-UAT.md');
		}
	);
});
