// TEST-05/TEST-06: the newest docs/test-evidence file records the Phase 15 evidence protocol.
// The file is hand-written from .tools/test-evidence logs (gitignored), so this pin is the only
// thing that keeps it honest: every row the phase gate relies on must be present and consistent,
// and each check is proven non-vacuous by deleting that row from an in-memory copy.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { LOAD_SENSITIVE_SPECS } from '../tooling/vitest/lanes';

const ROOT = join(import.meta.dirname, '..');
const EVIDENCE_DIR = join(ROOT, 'docs/test-evidence');
const DATED = /^\d{4}-\d{2}-\d{2}\.md$/;

function newestEvidenceFile(): string {
	const names = readdirSync(EVIDENCE_DIR)
		.filter((n) => DATED.test(n))
		.sort();
	const newest = names.at(-1);
	if (!newest) throw new Error(`no YYYY-MM-DD.md file under ${EVIDENCE_DIR}`);
	return newest;
}

const NEWEST = newestEvidenceFile();
const DOC = readFileSync(join(EVIDENCE_DIR, NEWEST), 'utf8').replace(/\r\n/g, '\n');

/** The `## <prefix>...` section (heading line included) up to the next `## ` heading, or ''. */
function section(md: string, prefix: string): string {
	const lines = md.split('\n');
	const start = lines.findIndex((l) => l.startsWith(`## ${prefix}`));
	if (start === -1) return '';
	let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
	if (end === -1) end = lines.length;
	return lines.slice(start, end).join('\n');
}

/** Every markdown table in `text` as rows of trimmed cells, header row first, separator rows dropped. */
function tables(text: string): string[][][] {
	const out: string[][][] = [];
	let current: string[][] | null = null;
	for (const line of text.split('\n')) {
		if (line.startsWith('|')) {
			const cells = line
				.split('|')
				.slice(1, -1)
				.map((c) => c.trim());
			if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
			(current ??= []).push(cells);
		} else if (current) {
			out.push(current);
			current = null;
		}
	}
	if (current) out.push(current);
	return out;
}

const NUM = /^\d+$/;
const asInt = (cell: string | undefined): number =>
	cell !== undefined && NUM.test(cell) ? Number(cell) : NaN;

/** Problems with an evidence document; [] means it records the whole protocol consistently. */
export function checkEvidence(md: string): string[] {
	const problems: string[] = [];

	if (!/^HEAD: `[0-9a-f]{7,40}`/m.test(md)) problems.push('missing HEAD: `<sha>` line');

	// ## 1. three verify runs, each exit 0
	const s1 = section(md, '1.');
	const verify = tables(s1)[0] ?? [];
	for (const run of ['1', '2', '3']) {
		const row = verify.find((r) => r[0] === run);
		if (!row) problems.push(`## 1. has no row for verify run ${run}`);
		else if (row[3] !== '0') problems.push(`## 1. verify run ${run} exit is ${row[3]}, not 0`);
	}

	// ## 2. one repeat-each row per load-sensitive spec, then the serial lane x3
	const s2 = section(md, '2.');
	const [repeat = [], serial = []] = tables(s2);
	for (const spec of LOAD_SENSITIVE_SPECS) {
		const row = repeat.find((r) => r[0] === spec);
		if (!row) {
			problems.push(`## 2. has no repeat-each row for ${spec}`);
			continue;
		}
		if (row[1] !== 'root, sub')
			problems.push(`## 2. ${spec} projects are ${row[1]}, not root, sub`);
		if (!(asInt(row[2]) >= 6)) problems.push(`## 2. ${spec} passed ${row[2]}, fewer than 6`);
		if (row[3] !== '0') problems.push(`## 2. ${spec} failed is ${row[3]}, not 0`);
		if (row[4] !== '0') problems.push(`## 2. ${spec} flaky is ${row[4]}, not 0`);
	}
	if (!s2.includes('### Vitest serial lane'))
		problems.push('## 2. has no Vitest serial lane heading');
	for (const run of ['1', '2', '3']) {
		const row = serial.find((r) => r[0] === run);
		if (!row) problems.push(`## 2. serial lane has no row for run ${run}`);
		else if (row[2] !== '0') problems.push(`## 2. serial lane run ${run} exit is ${row[2]}, not 0`);
	}

	// ## 3. one full E2E under at least 12 burner threads covering at least 75% of the CPUs, 0 failed, 0 flaky
	const s3 = section(md, '3.');
	const pressure = (tables(s3)[0] ?? []).slice(1);
	const under = pressure.find((r) => asInt(r[0]) >= 12 && asInt(r[0]) * 4 >= asInt(r[1]) * 3);
	if (!under) problems.push('## 3. has no row with burner threads >= 12 and >= 75% of CPUs');
	else {
		if (under[6] !== '0') problems.push(`## 3. failed is ${under[6]}, not 0`);
		if (under[7] !== '0') problems.push(`## 3. flaky is ${under[7]}, not 0`);
	}
	if (!/cpu-burn: \d+ threads on \d+ CPUs, started /.test(s3))
		problems.push('## 3. lacks the cpu-burn start line');
	if (!/cpu-burn: stopped /.test(s3)) problems.push('## 3. lacks the cpu-burn stop line');

	// ## 4. one shuffled unit run: seed in the Seed line, the command and the output line all agree
	const s4 = section(md, '4.');
	const seed = /^Seed: `(\d+)`/m.exec(s4)?.[1];
	if (!seed) problems.push('## 4. has no Seed: `<n>` line');
	else {
		if (!s4.includes(`--sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=${seed}`))
			problems.push(`## 4. command does not shuffle files and tests with seed ${seed}`);
		if (!s4.includes(`Running tests with seed "${seed}"`))
			problems.push(`## 4. output line does not report seed ${seed}`);
	}
	const shuffle = (tables(s4)[0] ?? []).slice(1);
	if (!shuffle.some((r) => r[0] === '0')) problems.push('## 4. has no row with exit 0');

	return problems;
}

/** The document without its first line matching `pattern` (throws if none matches, so a negative cannot be vacuous). */
function dropLine(md: string, pattern: RegExp): string {
	const lines = md.split('\n');
	const i = lines.findIndex((l) => pattern.test(l));
	if (i === -1) throw new Error(`no line matches ${pattern}`);
	lines.splice(i, 1);
	return lines.join('\n');
}

describe('newest evidence file', () => {
	test('is dated and records the whole protocol', () => {
		expect(NEWEST).toMatch(DATED);
		expect(checkEvidence(DOC)).toEqual([]);
	});

	test('names every load-sensitive spec and nothing is left as a template placeholder', () => {
		expect(LOAD_SENSITIVE_SPECS.length).toBeGreaterThanOrEqual(12); // non-vacuity of the loop above
		for (const spec of LOAD_SENSITIVE_SPECS) expect(DOC).toContain(spec);
		expect(DOC).not.toMatch(/<[A-Za-z][A-Za-z0-9 _-]*>/);
		expect(DOC).not.toMatch(/\.\.\. \|/);
	});
});

describe('planted negatives (one per record the gate relies on)', () => {
	const negatives: [string, (md: string) => string, RegExp][] = [
		['HEAD line removed', (md) => dropLine(md, /^HEAD: `/), /HEAD/],
		['verify run 2 removed', (md) => dropLine(md, /^\| 2\s+\| \d{4}-/), /## 1\. .*run 2/],
		[
			'verify run 3 exit changed',
			(md) => md.replace(/^(\| 3\s+\| \d{4}-[^|]+\| [^|]+\| )0(\s+\|)/m, '$11$2'),
			/## 1\. .*run 3 exit is 1/
		],
		[
			'csp.spec.ts repeat row removed',
			(md) => dropLine(md, /^\| csp\.spec\.ts\s+\|/),
			/## 2\. .*csp\.spec\.ts/
		],
		[
			'serial lane run 3 removed',
			(md) => dropLine(md, /^\| 3\s+\| `pnpm vitest run --project/),
			/## 2\. serial lane .*run 3/
		],
		['pressure row removed', (md) => dropLine(md, /^\| 12\s+\| 16\s+\|/), /## 3\. has no row/],
		[
			'pressure row weakened to 8 of 16 threads',
			(md) => md.replace(/^\| 12(\s+)\| 16\s+\|/m, '| 8 $1| 16 |'),
			/## 3\. has no row/
		],
		[
			'cpu-burn stop line removed',
			(md) => dropLine(md, /cpu-burn: stopped/),
			/## 3\. lacks the cpu-burn stop line/
		],
		[
			'seed mismatch in the output line',
			(md) => md.replace(/Running tests with seed "(\d+)"/, 'Running tests with seed "$10"'),
			/## 4\. output line/
		],
		[
			'shuffle result row removed',
			(md) => dropLine(md, /^\| 0\s+\| \d+ passed/),
			/## 4\. has no row with exit 0/
		]
	];

	test.each(negatives)('%s is reported', (_name, mutate, expected) => {
		const mutated = mutate(DOC);
		expect(mutated).not.toBe(DOC);
		const problems = checkEvidence(mutated);
		expect(problems.length).toBeGreaterThan(0);
		expect(
			problems.some((p) => expected.test(p)),
			problems.join('\n')
		).toBe(true);
	});
});
