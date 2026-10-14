// Launch-audit evidence in chunks (10-23).
//
// scripts/launch-audit.mjs reads three reports from apps/web/test-results/: the Playwright JSON
// report (e2e-report.json), the Vitest JSON report (vitest.json) and perf.spec's cls.json. The full
// E2E suite does not fit one short run, and Playwright EMPTIES apps/web/test-results/ at the start of
// every run, so a later shard would delete an earlier shard's reports. This tool keeps every shard's
// reports OUTSIDE test-results, in .tools/audit-evidence/ (gitignored), and assembles them at the end:
//
//   node scripts/audit-evidence.mjs clean
//   node scripts/audit-evidence.mjs e2e <name> [playwright args]   e.g. e2e a11y a11y.spec --project=root
//   node scripts/audit-evidence.mjs unit <name> [vitest args]      e.g. unit scripts --project scripts
//   node scripts/audit-evidence.mjs merge                          -> apps/web/test-results/*.json
//   pnpm audit:launch
//
// `e2e` and `unit` exit with the runner's exit code. A re-run of a shard name replaces that shard's
// files. `merge` never hides a failure: every test of every shard is kept (a test that ran in two
// shards appears twice), and it refuses to write anything when a shard file is unreadable.
import { spawnSync } from 'node:child_process';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EVIDENCE_DIR = '.tools/audit-evidence';
export const RESULTS_DIR = 'apps/web/test-results';
export const OUTPUTS = Object.freeze({
	e2e: `${RESULTS_DIR}/e2e-report.json`,
	unit: `${RESULTS_DIR}/vitest.json`,
	cls: `${RESULTS_DIR}/cls.json`
});
const SHARD_NAME = /^[a-z0-9][a-z0-9_-]*$/i;
const KINDS = /** @type {const} */ (['e2e', 'unit', 'cls']);

/**
 * The evidence file for one shard.
 * @param {'e2e' | 'unit' | 'cls'} kind
 * @param {string} name
 */
export function shardFile(kind, name) {
	if (!KINDS.includes(kind)) throw new Error(`unknown evidence kind ${kind}`);
	if (!SHARD_NAME.test(name)) {
		throw new Error(`shard name must match ${SHARD_NAME} (got ${JSON.stringify(name)})`);
	}
	return `${kind}-${name}.json`;
}

/**
 * Groups the files of the evidence directory by kind, sorted by name. Unknown files are ignored.
 * @param {string[]} files
 * @returns {{ e2e: string[]; unit: string[]; cls: string[] }}
 */
export function classify(files) {
	/** @type {{ e2e: string[]; unit: string[]; cls: string[] }} */
	const out = { e2e: [], unit: [], cls: [] };
	for (const f of [...files].sort()) {
		const m = /^(e2e|unit|cls)-(.+)\.json$/.exec(f);
		if (m && SHARD_NAME.test(m[2])) out[/** @type {'e2e' | 'unit' | 'cls'} */ (m[1])].push(f);
	}
	return out;
}

const STAT_KEYS = ['expected', 'unexpected', 'flaky', 'skipped'];

/**
 * Merges Playwright JSON reports: `suites` concatenated in order, stats summed, errors kept.
 * @param {{ name: string; report: any }[]} shards
 */
export function mergeE2eReports(shards) {
	if (shards.length === 0) throw new Error('no E2E shard reports to merge');
	const suites = [];
	const errors = [];
	const stats = { expected: 0, unexpected: 0, flaky: 0, skipped: 0, duration: 0 };
	for (const { name, report } of shards) {
		if (!report || !Array.isArray(report.suites)) {
			throw new Error(`E2E shard "${name}" is not a Playwright JSON report (no suites array)`);
		}
		suites.push(...report.suites);
		errors.push(...(report.errors ?? []));
		for (const k of STAT_KEYS) stats[k] += Number(report.stats?.[k] ?? 0);
		stats.duration += Number(report.stats?.duration ?? 0);
	}
	return {
		config: shards[0].report.config ?? {},
		suites,
		errors,
		stats: { ...stats, startTime: shards[0].report.stats?.startTime ?? null },
		shards: shards.map((s) => s.name)
	};
}

/**
 * Merges Vitest JSON reports: `testResults` concatenated, counters summed, success only if every
 * shard succeeded.
 * @param {{ name: string; report: any }[]} shards
 */
export function mergeVitestReports(shards) {
	if (shards.length === 0) throw new Error('no unit shard reports to merge');
	const counters = [
		'numTotalTestSuites',
		'numPassedTestSuites',
		'numFailedTestSuites',
		'numPendingTestSuites',
		'numTotalTests',
		'numPassedTests',
		'numFailedTests',
		'numPendingTests',
		'numTodoTests'
	];
	/** @type {Record<string, any>} */
	const out = { testResults: [], success: true, shards: shards.map((s) => s.name) };
	for (const k of counters) out[k] = 0;
	for (const { name, report } of shards) {
		if (!report || !Array.isArray(report.testResults)) {
			throw new Error(`unit shard "${name}" is not a Vitest JSON report (no testResults array)`);
		}
		out.testResults.push(...report.testResults);
		for (const k of counters) out[k] += Number(report[k] ?? 0);
		out.success = out.success && report.success === true;
	}
	return out;
}

/**
 * Concatenates perf.spec CLS rows from every shard that wrote some.
 * @param {{ name: string; report: any }[]} shards
 */
export function mergeCls(shards) {
	const rows = [];
	for (const { name, report } of shards) {
		if (!Array.isArray(report)) throw new Error(`CLS shard "${name}" is not an array of rows`);
		rows.push(...report);
	}
	return rows;
}

/**
 * Flat counts of a (merged) Playwright report: tests, pass, fail, skip, plus keys seen twice.
 * @param {any} report
 */
export function e2eCounts(report) {
	let pass = 0;
	let fail = 0;
	let skip = 0;
	const seen = new Set();
	let duplicates = 0;
	/** @type {string[]} */
	const failed = [];
	const walk = (suite, titles) => {
		const own = suite.title && suite.title !== suite.file ? [...titles, suite.title] : titles;
		for (const spec of suite.specs ?? []) {
			for (const t of spec.tests ?? []) {
				const key = `${t.projectName ?? ''} ${[spec.file, ...own, spec.title].join(' > ')}`;
				if (seen.has(key)) duplicates++;
				seen.add(key);
				if (t.status === 'expected' || t.status === 'flaky') pass++;
				else if (t.status === 'skipped') skip++;
				else {
					fail++;
					failed.push(`[${t.projectName}] ${spec.file}:${spec.line} ${spec.title}`);
				}
			}
		}
		for (const s of suite.suites ?? []) walk(s, own);
	};
	for (const s of report.suites ?? []) walk(s, []);
	return { tests: pass + fail + skip, pass, fail, skip, duplicates, failed };
}

const readShards = (dir, files) =>
	files.map((f) => {
		const name = f.replace(/^(e2e|unit|cls)-/, '').replace(/\.json$/, '');
		let report;
		try {
			report = JSON.parse(readFileSync(join(dir, f), 'utf8'));
		} catch (e) {
			throw new Error(`${join(dir, f)}: unreadable JSON (${e.message})`, { cause: e });
		}
		return { name, report };
	});

/**
 * Assembles the merged reports under `root`. Throws (writing nothing) on a bad shard.
 * @param {string} root
 */
export function mergeEvidence(root) {
	const dir = join(root, EVIDENCE_DIR);
	if (!existsSync(dir)) throw new Error(`${EVIDENCE_DIR} does not exist; run some shards first`);
	const groups = classify(readdirSync(dir));
	const e2e = mergeE2eReports(readShards(dir, groups.e2e));
	const unit = groups.unit.length ? mergeVitestReports(readShards(dir, groups.unit)) : null;
	const cls = groups.cls.length ? mergeCls(readShards(dir, groups.cls)) : null;
	mkdirSync(join(root, RESULTS_DIR), { recursive: true });
	writeFileSync(join(root, OUTPUTS.e2e), JSON.stringify(e2e));
	if (unit) writeFileSync(join(root, OUTPUTS.unit), JSON.stringify(unit));
	if (cls) writeFileSync(join(root, OUTPUTS.cls), `${JSON.stringify(cls, null, 2)}\n`);
	return { groups, e2e: e2eCounts(e2e), unit, cls };
}

function pnpm(args, opts) {
	const execPath = process.env.npm_execpath;
	const [bin, pre] = execPath ? [process.execPath, [execPath]] : ['corepack', ['pnpm']];
	return spawnSync(bin, [...pre, ...args], {
		stdio: 'inherit',
		shell: !execPath && process.platform === 'win32',
		...opts
	});
}

function main(argv) {
	const root = join(import.meta.dirname, '..');
	const dir = join(root, EVIDENCE_DIR);
	const [cmd, name, ...rest] = argv;
	const usage =
		'usage: node scripts/audit-evidence.mjs clean | e2e <name> [playwright args] | unit <name> [vitest args] | merge';
	if (cmd === 'clean') {
		rmSync(dir, { recursive: true, force: true });
		console.log(`Removed ${EVIDENCE_DIR}`);
		return 0;
	}
	if (cmd === 'merge') {
		const r = mergeEvidence(root);
		console.log(
			`Merged ${r.groups.e2e.length} E2E shard(s) -> ${OUTPUTS.e2e}: ${r.e2e.tests} tests, ${r.e2e.pass} passed, ${r.e2e.fail} failed, ${r.e2e.skip} skipped, ${r.e2e.duplicates} ran in more than one shard`
		);
		for (const f of r.e2e.failed) console.log(`  FAILED ${f}`);
		console.log(
			r.unit
				? `Merged ${r.groups.unit.length} unit shard(s) -> ${OUTPUTS.unit}: ${r.unit.numTotalTests} tests, ${r.unit.numFailedTests} failed`
				: `No unit shards: ${OUTPUTS.unit} not written`
		);
		console.log(
			r.cls
				? `Merged ${r.cls.length} CLS row(s) -> ${OUTPUTS.cls}`
				: `No CLS rows: ${OUTPUTS.cls} not written (include perf.spec in a shard)`
		);
		return 0;
	}
	if (cmd !== 'e2e' && cmd !== 'unit') {
		console.error(usage);
		return 2;
	}
	shardFile(cmd, name ?? ''); // validates the name
	mkdirSync(dir, { recursive: true });
	if (cmd === 'unit') {
		const out = join(dir, shardFile('unit', name));
		rmSync(out, { force: true });
		const r = pnpm(
			[
				'exec',
				'vitest',
				'run',
				...rest,
				'--reporter=dot',
				'--reporter=json',
				`--outputFile.json=${out}`
			],
			{ cwd: root }
		);
		return r.status ?? 1;
	}
	const out = join(dir, shardFile('e2e', name));
	const clsOut = join(dir, shardFile('cls', name));
	rmSync(out, { force: true });
	rmSync(clsOut, { force: true });
	const r = pnpm(['exec', 'playwright', 'test', ...rest, '--reporter=json,dot'], {
		cwd: join(root, 'apps/web'),
		env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: out }
	});
	// perf.spec writes cls.json into test-results, which the next run empties: keep a copy.
	const cls = join(root, OUTPUTS.cls);
	if (existsSync(cls)) copyFileSync(cls, clsOut);
	if (!existsSync(out)) console.error(`Playwright wrote no JSON report to ${out}`);
	return r.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		process.exitCode = main(process.argv.slice(2));
	} catch (e) {
		console.error(e instanceof Error ? e.message : e);
		process.exitCode = 1;
	}
}
