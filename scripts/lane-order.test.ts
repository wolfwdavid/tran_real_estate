// Behavioural proof of the lane mechanism (TEST-01) on the installed Vitest. A throwaway fixture
// under <repo>/.tools has a parallel project (group 0), a node-serial project at
// SERIAL_GROUP_ORDER.scripts and a stand-in for the browser-serial lane at
// SERIAL_GROUP_ORDER['web-browser']; every fixture file logs its wall-clock start and end. The
// assertions must hold plain and under --sequence.shuffle.* with a recorded seed. The real root
// config's VITEST_MAX_WORKERS refusal is proven here too. Lives in scripts-serial: it compares
// wall-clock order, so it is exactly the kind of test the parallel lane forbids.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { SERIAL_GROUP_ORDER } from '../tooling/vitest/lanes';

const REPO = join(import.meta.dirname, '..');
const VITEST = join(REPO, 'node_modules/vitest/vitest.mjs');
const NODE_SERIAL = SERIAL_GROUP_ORDER.scripts;
const BROWSER_SERIAL = SERIAL_GROUP_ORDER['web-browser'];
// Parallel files sleep long enough that two workers provably overlap even under machine load;
// serial files only need to be long enough to measure.
const PAR_MS = 3000;
const SER_MS = 1000;

type Mark = { f: string; at: 'start' | 'end'; t: number };
type Interval = { f: string; start: number; end: number };
type Lanes = { par: Interval[]; ser: Interval[]; bser: Interval[] };

let dir: string;
let log: string;

/** process.env without the VITEST* keys the parent run injects (VITEST_MAX_WORKERS is one of them). */
const cleanEnv = (): NodeJS.ProcessEnv =>
	Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^VITEST/.test(k)));

const fixtureTest = (name: string, ms: number) =>
	[
		"import { test } from 'vitest';",
		"import { appendFileSync } from 'node:fs';",
		'const mark = (at: string) =>',
		`\tappendFileSync(process.env.LANE_LOG!, JSON.stringify({ f: '${name}', at, t: Date.now() }) + '\\n');`,
		"test('t', async () => {",
		"\tmark('start');",
		`\tawait new Promise((r) => setTimeout(r, ${ms}));`,
		"\tmark('end');",
		'});',
		''
	].join('\n');

const projectConfig = (name: string, include: string, groupOrder: number | null) => {
	const serial =
		groupOrder === null
			? ''
			: `, fileParallelism: false, maxWorkers: 1, sequence: { groupOrder: ${groupOrder} }`;
	return `import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { name: '${name}', include: ['${include}']${serial} } });\n`;
};

const write = (rel: string, text: string) => {
	const abs = join(dir, rel);
	mkdirSync(join(abs, '..'), { recursive: true });
	writeFileSync(abs, text);
};

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;
const maxEnd = (xs: Interval[]) => Math.max(...xs.map((i) => i.end));
const minStart = (xs: Interval[]) => Math.min(...xs.map((i) => i.start));

function run(args: string[]) {
	rmSync(log, { force: true });
	const r = spawnSync(process.execPath, [VITEST, 'run', '--root', dir, ...args], {
		cwd: dir,
		encoding: 'utf8',
		env: { ...cleanEnv(), LANE_LOG: log },
		timeout: 50_000
	});
	if (r.error) throw r.error;
	const out = r.stdout + r.stderr;
	const marks = readFileSync(log, 'utf8')
		.trim()
		.split('\n')
		.map((l) => JSON.parse(l) as Mark);
	const byFile = new Map<string, Interval>();
	for (const m of marks) {
		const i = byFile.get(m.f) ?? { f: m.f, start: NaN, end: NaN };
		i[m.at] = m.t;
		byFile.set(m.f, i);
	}
	const lanes: Lanes = { par: [], ser: [], bser: [] };
	for (const i of byFile.values()) lanes[i.f.split('/')[0] as keyof Lanes].push(i);
	return { status: r.status, out, lanes };
}

/** The three facts the lanes rest on; `label` names the run in a failure message. */
function expectLaneOrder({ par, ser, bser }: Lanes, label: string) {
	expect(par, `${label}: parallel files`).toHaveLength(2);
	expect(ser, `${label}: node-serial files`).toHaveLength(2);
	expect(bser, `${label}: browser-serial stand-in files`).toHaveLength(2);
	// Non-vacuity: the parallel files really ran at the same time.
	expect(overlaps(par[0], par[1]), `${label}: parallel files overlap`).toBe(true);
	// Every parallel file ends before the first node-serial file starts.
	expect(minStart(ser), `${label}: node-serial after parallel`).toBeGreaterThanOrEqual(maxEnd(par));
	// Node-serial files run one at a time.
	expect(overlaps(ser[0], ser[1]), `${label}: node-serial files overlap`).toBe(false);
	// Every node-serial file ends before the first browser-serial file starts (the later group).
	expect(minStart(bser), `${label}: browser-serial after node-serial`).toBeGreaterThanOrEqual(
		maxEnd(ser)
	);
	expect(overlaps(bser[0], bser[1]), `${label}: browser-serial files overlap`).toBe(false);
}

beforeAll(() => {
	dir = join(REPO, '.tools', `lane-order-${process.pid}-${Math.random().toString(36).slice(2)}`);
	log = join(dir, 'lane.log');
	mkdirSync(dir, { recursive: true });
	write(
		'vitest.config.ts',
		"import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { maxWorkers: 2, projects: ['vitest.par.config.ts', 'vitest.ser.config.ts', 'vitest.bser.config.ts'] } });\n"
	);
	write('vitest.par.config.ts', projectConfig('par', 'par/*.test.ts', null));
	write('vitest.ser.config.ts', projectConfig('par-serial', 'ser/*.test.ts', NODE_SERIAL));
	write('vitest.bser.config.ts', projectConfig('bser-serial', 'bser/*.test.ts', BROWSER_SERIAL));
	write('par/a.test.ts', fixtureTest('par/a', PAR_MS));
	write('par/b.test.ts', fixtureTest('par/b', PAR_MS));
	write('ser/c.test.ts', fixtureTest('ser/c', SER_MS));
	write('ser/d.test.ts', fixtureTest('ser/d', SER_MS));
	write('bser/e.test.ts', fixtureTest('bser/e', SER_MS));
	write('bser/f.test.ts', fixtureTest('bser/f', SER_MS));
});

afterAll(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe('per-lane group order (tooling/vitest/lanes.ts)', () => {
	test('every serial lane runs after the parallel group and the browser lane runs last', () => {
		const entries = Object.entries(SERIAL_GROUP_ORDER);
		expect(entries.length).toBeGreaterThanOrEqual(4);
		for (const [lane, order] of entries) expect(order, lane).toBeGreaterThan(0);
		for (const [lane, order] of entries) {
			if (lane !== 'web-browser') expect(BROWSER_SERIAL, `web-browser > ${lane}`).toBeGreaterThan(order);
		}
	});
});

describe('lane mechanism on the installed Vitest', () => {
	test('plain run: parallel overlap, node-serial after parallel, browser-serial after node-serial', () => {
		const r = run([]);
		expect(r.status, r.out).toBe(0);
		expectLaneOrder(r.lanes, 'plain');
	});

	test('shuffled run (--sequence.seed=7) keeps the same order and prints the seed', () => {
		const r = run(['--sequence.shuffle.files', '--sequence.shuffle.tests', '--sequence.seed=7']);
		expect(r.status, r.out).toBe(0);
		expect(r.out).toContain('Running tests with seed "7"');
		expectLaneOrder(r.lanes, 'shuffled');
	});

	test('the real root config refuses to run when VITEST_MAX_WORKERS is set', () => {
		const r = spawnSync(process.execPath, [VITEST, 'run', '--project', 'brand'], {
			cwd: REPO,
			encoding: 'utf8',
			env: { ...cleanEnv(), VITEST_MAX_WORKERS: '2' },
			timeout: 50_000
		});
		if (r.error) throw r.error;
		const out = r.stdout + r.stderr;
		expect(r.status, out).not.toBe(0);
		expect(out).toContain('VITEST_MAX_WORKERS overrides fileParallelism:false');
	});
});
