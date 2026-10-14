import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
	EVIDENCE_DIR,
	OUTPUTS,
	classify,
	e2eCounts,
	mergeCls,
	mergeE2eReports,
	mergeEvidence,
	mergeVitestReports,
	shardFile
} from './audit-evidence.mjs';
import { a11yMatrix, e2eTests, unitTests } from './launch-audit.mjs';

const spec = (file: string, title: string, project: string, status: string, line = 1) => ({
	title,
	file,
	line,
	tests: [{ projectName: project, status, results: [{ errors: [] }] }]
});

const report = (file: string, specs: unknown[], stats = {}) => ({
	config: { version: '1.63.0' },
	suites: [{ title: file, file, specs, suites: [] }],
	errors: [],
	stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0, duration: 10, ...stats }
});

const A = report(
	'a11y.spec.ts',
	[
		spec('a11y.spec.ts', 'axe reports no WCAG A/AA violations on ""', 'root', 'expected'),
		spec('a11y.spec.ts', 'axe reports no WCAG A/AA violations on ""', 'sub', 'expected')
	],
	{ expected: 2 }
);
const B = report(
	'perf.spec.ts',
	[
		spec('perf.spec.ts', 'landing layout-shift below 0.1', 'root', 'expected'),
		spec('perf.spec.ts', 'landing layout-shift below 0.1', 'sub', 'skipped'),
		spec('perf.spec.ts', 'broken', 'root', 'unexpected', 42)
	],
	{ expected: 1, skipped: 1, unexpected: 1 }
);

describe('shard names and files', () => {
	test('shardFile names files by kind and rejects path-like or empty names', () => {
		expect(shardFile('e2e', 'a11y')).toBe('e2e-a11y.json');
		expect(shardFile('unit', 'scripts')).toBe('unit-scripts.json');
		expect(shardFile('cls', 's-1')).toBe('cls-s-1.json');
		for (const bad of ['', '../x', 'a/b', '-x', 'a b']) {
			expect(() => shardFile('e2e', bad), bad).toThrow(/shard name/);
		}
		// @ts-expect-error -- runtime guard
		expect(() => shardFile('html', 'a')).toThrow(/unknown evidence kind/);
	});

	test('classify groups evidence files by kind, sorted, ignoring anything else', () => {
		expect(
			classify([
				'e2e-s2.json',
				'cls-perf.json',
				'e2e-a11y.json',
				'unit-web.json',
				'notes.txt',
				'e2e-.json'
			])
		).toEqual({
			e2e: ['e2e-a11y.json', 'e2e-s2.json'],
			unit: ['unit-web.json'],
			cls: ['cls-perf.json']
		});
	});
});

describe('mergeE2eReports', () => {
	test('concatenates suites in shard order and sums the stats', () => {
		const m = mergeE2eReports([
			{ name: 'a11y', report: A },
			{ name: 'perf', report: B }
		]);
		expect(m.suites.map((s: { file: string }) => s.file)).toEqual(['a11y.spec.ts', 'perf.spec.ts']);
		expect(m.stats).toMatchObject({
			expected: 3,
			unexpected: 1,
			skipped: 1,
			flaky: 0,
			duration: 20
		});
		expect(m.shards).toEqual(['a11y', 'perf']);
	});

	test('the merged report keeps every test, including failures, for the launch audit', () => {
		const m = mergeE2eReports([
			{ name: 'a11y', report: A },
			{ name: 'perf', report: B }
		]);
		const tests = e2eTests(m) ?? [];
		expect(tests).toHaveLength(5);
		expect(tests.filter((t) => t.outcome === 'fail').map((t) => t.title)).toEqual(['broken']);
		// The audit's own matrix reads the landing cells from the merged report.
		const row = a11yMatrix(m).rows.find((r: { route: string }) => r.route === '');
		expect(row?.cells['keyless/root'].status).toBe('PASS');
		expect(row?.cells['keyless/sub'].status).toBe('PASS');
	});

	test('a shard that ran the same test twice is counted twice, never collapsed', () => {
		const m = mergeE2eReports([
			{ name: 'a', report: A },
			{ name: 'again', report: A }
		]);
		expect(e2eCounts(m)).toMatchObject({ tests: 4, pass: 4, fail: 0, duplicates: 2 });
	});

	test('e2eCounts lists failing tests with project, file and line', () => {
		const c = e2eCounts(mergeE2eReports([{ name: 'perf', report: B }]));
		expect(c).toMatchObject({ tests: 3, pass: 1, fail: 1, skip: 1 });
		expect(c.failed).toEqual(['[root] perf.spec.ts:42 broken']);
	});

	test('rejects an empty shard list and a file that is not a Playwright report', () => {
		expect(() => mergeE2eReports([])).toThrow(/no E2E shard/);
		expect(() => mergeE2eReports([{ name: 'x', report: { tests: [] } }])).toThrow(/"x"/);
		expect(() => mergeE2eReports([{ name: 'n', report: null }])).toThrow(/"n"/);
	});
});

describe('mergeVitestReports and mergeCls', () => {
	const v = (file: string, status: string, success: boolean) => ({
		success,
		numTotalTests: 1,
		numPassedTests: status === 'passed' ? 1 : 0,
		numFailedTests: status === 'failed' ? 1 : 0,
		testResults: [{ name: file, assertionResults: [{ title: 't', ancestorTitles: [], status }] }]
	});

	test('concatenates testResults, sums counters and fails if any shard failed', () => {
		const ok = mergeVitestReports([
			{ name: 'a', report: v('a.test.ts', 'passed', true) },
			{ name: 'b', report: v('b.test.ts', 'passed', true) }
		]);
		expect(ok).toMatchObject({ success: true, numTotalTests: 2, numPassedTests: 2 });
		expect(unitTests(ok)?.map((t) => t.file)).toEqual(['a.test.ts', 'b.test.ts']);
		const bad = mergeVitestReports([
			{ name: 'a', report: v('a.test.ts', 'passed', true) },
			{ name: 'b', report: v('b.test.ts', 'failed', false) }
		]);
		expect(bad).toMatchObject({ success: false, numFailedTests: 1 });
	});

	test('rejects an empty list and a non-Vitest file', () => {
		expect(() => mergeVitestReports([])).toThrow(/no unit shard/);
		expect(() => mergeVitestReports([{ name: 'z', report: { suites: [] } }])).toThrow(/"z"/);
	});

	test('concatenates CLS rows and rejects a non-array', () => {
		const r = { route: '', viewport: '375x812', state: 'first-visit', cls: 0.01 };
		expect(
			mergeCls([
				{ name: 'p', report: [r] },
				{ name: 'q', report: [r] }
			])
		).toHaveLength(2);
		expect(() => mergeCls([{ name: 'p', report: { rows: [] } }])).toThrow(/"p"/);
	});
});

describe('mergeEvidence (files)', () => {
	let root = '';
	afterEach(() => {
		if (root) rmSync(root, { recursive: true, force: true });
		root = '';
	});
	const setup = (files: Record<string, string>) => {
		root = mkdtempSync(join(tmpdir(), 'audit-evidence-'));
		mkdirSync(join(root, EVIDENCE_DIR), { recursive: true });
		for (const [f, body] of Object.entries(files)) writeFileSync(join(root, EVIDENCE_DIR, f), body);
	};

	test('writes the three reports the launch audit reads', () => {
		setup({
			'e2e-a11y.json': JSON.stringify(A),
			'e2e-perf.json': JSON.stringify(B),
			'unit-all.json': JSON.stringify({ success: true, numTotalTests: 0, testResults: [] }),
			'cls-perf.json': JSON.stringify([
				{ route: '', viewport: '1280x800', state: 'returning', cls: 0 }
			])
		});
		const r = mergeEvidence(root);
		expect(r.e2e).toMatchObject({ tests: 5, fail: 1 });
		const e2e = JSON.parse(readFileSync(join(root, OUTPUTS.e2e), 'utf8'));
		expect(e2e.suites).toHaveLength(2);
		expect(JSON.parse(readFileSync(join(root, OUTPUTS.unit), 'utf8')).success).toBe(true);
		expect(JSON.parse(readFileSync(join(root, OUTPUTS.cls), 'utf8'))).toHaveLength(1);
	});

	test('without unit or CLS shards only e2e-report.json is written', () => {
		setup({ 'e2e-a11y.json': JSON.stringify(A) });
		const r = mergeEvidence(root);
		expect(r.unit).toBeNull();
		expect(r.cls).toBeNull();
		expect(existsSync(join(root, OUTPUTS.unit))).toBe(false);
		expect(existsSync(join(root, OUTPUTS.cls))).toBe(false);
	});

	test('an unreadable shard aborts the merge before anything is written', () => {
		setup({ 'e2e-a11y.json': JSON.stringify(A), 'e2e-s2.json': '{"suites": [' });
		expect(() => mergeEvidence(root)).toThrow(/e2e-s2\.json: unreadable JSON/);
		expect(existsSync(join(root, OUTPUTS.e2e))).toBe(false);
	});

	test('no E2E shard at all is an error, not an empty report', () => {
		setup({ 'unit-all.json': JSON.stringify({ success: true, testResults: [] }) });
		expect(() => mergeEvidence(root)).toThrow(/no E2E shard/);
	});

	test('a missing evidence directory is an error', () => {
		root = mkdtempSync(join(tmpdir(), 'audit-evidence-'));
		expect(() => mergeEvidence(root)).toThrow(/does not exist/);
	});
});
