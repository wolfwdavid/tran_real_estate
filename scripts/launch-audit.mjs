// Launch-audit generator (10-22). Turns every Phase 10 gate into docs/LAUNCH-AUDIT.md.
// Usage: node scripts/launch-audit.mjs [--write]
//
// collect() gathers REAL results: in-process oracle calls (checkBuild, checkSeo, checkBudget,
// findBanned), spawned command gates (exit codes), and the Playwright / Vitest / CLS JSON reports
// a full run leaves in apps/web/test-results/. renderAudit() is a pure function of that data, so
// every status is derived, never asserted: a missing report, an unmatched test, a failing test or
// a non-zero exit code renders FAIL. The document is regenerated, never hand-edited.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveBasePath } from '../apps/web/src/lib/base-path.js';
import { resolveAnalytics, resolveSiteOrigin } from '../apps/web/src/lib/site-config.js';
import { EXACT, checkBuild, countPages } from './assert-csp.mjs';
import { BUDGET_BYTES, checkBudget } from './assert-budget.mjs';
import { checkSeo } from './assert-seo.mjs';
import { collectFiles } from './banned-terms.mjs';
import { AUDIT_EXCEPTIONS } from './lib/audit-exceptions.mjs';
import { findBanned } from './lib/banned-terms-rules.mjs';
import { TARGETS, targetEnv } from './lib/build-targets.mjs';
import { HUMAN_UAT, PITFALLS_EVIDENCE } from './lib/pitfalls-evidence.mjs';

const CHECKLIST_HEADING = `## "Looks Done But Isn't" Checklist`;

/**
 * Command gates the collector runs (or evaluates in-process when `run` is null). PITFALLS
 * evidence rows of type 'command' name one of these ids. Later plans register new gates here.
 * @type {readonly { id: string; command: string; run: string[] | null }[]}
 */
export const COMMAND_GATES = Object.freeze([
	{ id: 'csp', command: 'pnpm csp:assert', run: null },
	{ id: 'seo', command: 'node scripts/assert-seo.mjs <build> --target <t>', run: null },
	{ id: 'budget', command: 'node scripts/assert-budget.mjs apps/web/build', run: null },
	{ id: 'banned', command: 'pnpm banned', run: null },
	{ id: 'deps', command: 'pnpm audit --json --audit-level low', run: null },
	{ id: 'guard', command: 'pnpm guard', run: ['node', 'scripts/guard-real-data.mjs', '--all'] },
	{
		id: 'fixtures:check',
		command: 'pnpm fixtures:check',
		run: ['node', 'scripts/gen-fixtures.mjs', '--check']
	},
	{
		id: 'secrets:canary',
		command: 'pnpm secrets:canary',
		run: ['node', 'scripts/gitleaks-canary.mjs']
	},
	{
		id: 'secrets:scan',
		command: 'pnpm secrets:scan',
		run: ['node', 'scripts/gitleaks.mjs', 'history']
	}
]);

/**
 * Every checklist line (text after `- [ ] `) of the "Looks Done But Isn't" section, verbatim.
 * @param {string} md PITFALLS.md text
 * @returns {string[]}
 */
export function parsePitfallsChecklist(md) {
	const start = md.indexOf(CHECKLIST_HEADING);
	if (start === -1) throw new Error(`PITFALLS.md has no ${CHECKLIST_HEADING} section`);
	const rest = md.slice(start + CHECKLIST_HEADING.length);
	const end = rest.search(/^## /m);
	const section = end === -1 ? rest : rest.slice(0, end);
	return section
		.split(/\r?\n/)
		.filter((l) => l.startsWith('- [ ] '))
		.map((l) => l.slice(6));
}

/**
 * The bold label of a checklist line (`**Label:** ...`), or null.
 * @param {string} line
 */
export function pitfallLabel(line) {
	return /^\*\*(.+?):\*\*/.exec(line)?.[1] ?? null;
}

/**
 * Checklist labels with no evidence entry, and entries with no checklist line.
 * @param {string[]} items parsed checklist lines
 * @param {Record<string, unknown>} map
 */
export function uncoveredPitfalls(items, map) {
	const labels = items.map((l) => pitfallLabel(l) ?? l);
	return {
		missing: labels.filter((l) => !Object.hasOwn(map, l)),
		stale: Object.keys(map).filter((k) => !labels.includes(k))
	};
}

/**
 * Shape errors in an evidence map, one string per problem, each prefixed `<label>:`.
 * @param {Record<string, any>} map
 * @param {readonly { id: string }[]} humanSteps
 * @returns {string[]}
 */
export function evidenceMapErrors(map, humanSteps) {
	const steps = new Set(humanSteps.map((s) => s.id));
	const commands = new Set(COMMAND_GATES.map((g) => g.id));
	/** @type {string[]} */
	const errors = [];
	for (const [label, e] of Object.entries(map)) {
		const err = (msg) => errors.push(`${label}: ${msg}`);
		if (!['auto', 'human', 'na'].includes(e?.kind)) {
			err(`kind must be auto, human or na (got ${JSON.stringify(e?.kind)})`);
			continue;
		}
		if (e.kind === 'auto') {
			if (!Array.isArray(e.evidence) || e.evidence.length === 0) err('auto needs evidence');
			for (const ev of e.evidence ?? []) {
				if (!['e2e', 'unit', 'command'].includes(ev?.type)) err(`bad evidence type ${ev?.type}`);
				else if (typeof ev.match !== 'string' || ev.match.trim() === '') err('empty match');
				else if (ev.type === 'command' && !commands.has(ev.match)) {
					err(`unknown command gate ${ev.match}`);
				}
			}
		} else if (typeof e.reason !== 'string' || e.reason.trim() === '') {
			err(`${e.kind} needs a reason`);
		}
		if (e.kind === 'human' && e.human === undefined) err('human needs a Human UAT step');
		if (e.human !== undefined && !steps.has(e.human)) err(`unknown Human UAT step ${e.human}`);
	}
	return errors;
}

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------

export const PASS = 'PASS';
export const FAIL = 'FAIL';
export const NA = 'N/A';
export const DEFERRED = 'DEFERRED (human)';

export const AUDIT_DOC = 'docs/LAUNCH-AUDIT.md';
export const EVIDENCE_DIR = 'docs/audit/';
export const E2E_REPORT = 'apps/web/test-results/e2e-report.json';
export const UNIT_REPORT = 'apps/web/test-results/vitest.json';
export const CLS_REPORT = 'apps/web/test-results/cls.json';
export const HUMAN_UAT_FILE = '.planning/phases/10-launch-hardening-go-to-market/10-HUMAN-UAT.md';
export const BUILD_COMMAND = 'pnpm build:root && pnpm build:sub && pnpm build:configured';
export const DISCLAIMER_PREFIX = 'disclaimer: ';
const DISCLAIMER_SPEC = 'apps/web/tests/e2e/disclaimers.spec.ts';

/** Performance table rows: build-relative page -> label. */
export const PERF_ROUTES = [
	'index.html',
	'tools/index.html',
	'tools/affordability/index.html',
	'tools/cap-rate/index.html',
	'tools/cash-on-cash/index.html',
	'tools/dscr/index.html'
];
const CLS_LIMIT = 0.1;

const AXE_KEYLESS = /^axe reports no WCAG A\/AA violations on ("(?:[^"\\]|\\.)*")$/;
const AXE_KEYED = /^axe \(keyed\) reports no WCAG A\/AA violations on ("(?:[^"\\]|\\.)*")$/;
export const A11Y_COLUMNS = [
	['keyless/root', 'Keyless (root)'],
	['keyless/sub', 'Keyless (sub)'],
	['keyed/root', 'Mocked key (root)'],
	['keyed/sub', 'Mocked key (sub)']
];

/**
 * Accessibility Contract extra states, summarised from axe test titles outside the route
 * matrix. `required` groups FAIL when no test matches; the catch-all is N/A when empty.
 */
export const EXTRA_A11Y = [
	{ name: 'Every route at 375px', match: /at 375px on /, required: true },
	{ name: 'Landing guide (step 0, tour steps, compact row)', match: /guide|tour/i, required: true },
	{
		name: 'Calculators (empty, example, invalid, not applicable)',
		match: /calculator|tools\//i,
		required: true
	},
	{ name: 'Waitlist and feedback forms', match: /waitlist|feedback/i, required: true },
	{ name: 'RentCast setup page', match: /setup/i, required: true },
	{ name: 'Other axe checks', match: /./, required: false }
];

// ---------------------------------------------------------------------------------------------
// Report normalization
// ---------------------------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*m/g, '');

/**
 * @typedef {{ key: string; file: string; title: string; project: string; outcome: 'pass' | 'fail' | 'skip'; errors: string[] }} TestCase
 */

/**
 * Flattens a Playwright JSON report. `key` is "<spec file> > <describe...> > <title>".
 * @param {any} report
 * @returns {TestCase[] | null} null when the report is missing
 */
export function e2eTests(report) {
	if (!report) return null;
	/** @type {TestCase[]} */
	const out = [];
	const walk = (suite, titles, file) => {
		const f = suite.file ?? file ?? '';
		const own = suite.title && suite.title !== f ? [...titles, suite.title] : titles;
		for (const spec of suite.specs ?? []) {
			const specFile = spec.file ?? f;
			for (const t of spec.tests ?? []) {
				const errors = (t.results ?? []).flatMap((r) =>
					[...(r.errors ?? []), ...(r.error ? [r.error] : [])].map((e) =>
						stripAnsi(e?.message ?? e?.value ?? e)
					)
				);
				out.push({
					key: [specFile, ...own, spec.title].join(' > '),
					file: specFile,
					title: spec.title,
					project: t.projectName ?? '',
					outcome:
						t.status === 'expected' || t.status === 'flaky'
							? 'pass'
							: t.status === 'skipped'
								? 'skip'
								: 'fail',
					errors
				});
			}
		}
		for (const s of suite.suites ?? []) walk(s, own, f);
	};
	for (const s of report.suites ?? []) walk(s, [], s.file);
	return out;
}

/**
 * Flattens a Vitest JSON report. `key` is "<test file, forward slashes> > <describe...> > <title>".
 * @param {any} report
 * @returns {TestCase[] | null} null when the report is missing
 */
export function unitTests(report) {
	if (!report) return null;
	return (report.testResults ?? []).flatMap((f) => {
		const file = String(f.name ?? '').replace(/\\/g, '/');
		return (f.assertionResults ?? []).map((a) => ({
			key: [file, ...(a.ancestorTitles ?? []), a.title].join(' > '),
			file,
			title: a.title,
			project: '',
			outcome: a.status === 'passed' ? 'pass' : a.status === 'failed' ? 'fail' : 'skip',
			errors: (a.failureMessages ?? []).map(stripAnsi)
		}));
	});
}

// ---------------------------------------------------------------------------------------------
// Evaluation (pure)
// ---------------------------------------------------------------------------------------------

/**
 * One evidence row against real results. Never PASS by default.
 * @param {{ type: string; match: string }} ev
 * @param {{ e2e: TestCase[] | null; unit: TestCase[] | null; commands: Record<string, { exitCode: number | null }> }} ctx
 * @returns {{ status: string; note: string }}
 */
export function evaluateEvidence(ev, ctx) {
	if (ev.type === 'command') {
		const c = ctx.commands?.[ev.match];
		if (!c) return { status: FAIL, note: `command ${ev.match}: not run` };
		return c.exitCode === 0
			? { status: PASS, note: `command ${ev.match}: exit 0` }
			: { status: FAIL, note: `command ${ev.match}: exit ${c.exitCode}` };
	}
	const label = `${ev.type} "${ev.match}"`;
	const tests = ev.type === 'e2e' ? ctx.e2e : ev.type === 'unit' ? ctx.unit : undefined;
	if (tests === undefined) return { status: FAIL, note: `${label}: unknown evidence type` };
	if (tests === null) return { status: FAIL, note: `${label}: report missing` };
	const hit = tests.filter((t) => t.key.includes(ev.match));
	if (hit.length === 0) return { status: FAIL, note: `${label}: no matching test` };
	const failed = hit.filter((t) => t.outcome === 'fail').length;
	if (failed) return { status: FAIL, note: `${label}: ${failed} of ${hit.length} failed` };
	const passed = hit.filter((t) => t.outcome === 'pass').length;
	if (!passed) return { status: FAIL, note: `${label}: all ${hit.length} matching tests skipped` };
	return { status: PASS, note: `${label}: ${passed} passed` };
}

const humanIndex = (id) => HUMAN_UAT.findIndex((s) => s.id === id) + 1;

/**
 * The checklist rows: every PITFALLS line verbatim with a status and evidence.
 * @param {any} data
 */
export function pitfallRows(data) {
	const map = data.evidence ?? PITFALLS_EVIDENCE;
	const ctx = {
		e2e: e2eTests(data.e2eReport),
		unit: unitTests(data.unitReport),
		commands: data.commands ?? {}
	};
	return (data.pitfalls ?? []).map((line) => {
		const label = pitfallLabel(line) ?? line;
		const entry = map[label];
		if (!entry)
			return {
				line,
				label,
				status: FAIL,
				evidence: 'no evidence declared in scripts/lib/pitfalls-evidence.mjs'
			};
		const extra = [];
		if (entry.human) extra.push(`owner step: Human UAT ${humanIndex(entry.human)}`);
		if (entry.kind === 'na') return { line, label, status: NA, evidence: entry.reason };
		if (entry.kind === 'human') {
			return { line, label, status: DEFERRED, evidence: [entry.reason, ...extra].join('; ') };
		}
		const results = (entry.evidence ?? []).map((ev) => evaluateEvidence(ev, ctx));
		const ok = results.length > 0 && results.every((r) => r.status === PASS);
		if (entry.reason) extra.push(`note: ${entry.reason}`);
		return {
			line,
			label,
			status: ok ? PASS : FAIL,
			evidence: [
				...results.map((r) => `${r.status === PASS ? '' : 'FAIL '}${r.note}`),
				...extra
			].join('; ')
		};
	});
}

/** Rule-id lines ("id (impact): help") from an axe assertion message. */
function violationLines(errors) {
	const out = new Set();
	for (const e of errors) {
		for (const l of e.split(/\r?\n/)) {
			const t = l.trim();
			if (/^[a-z0-9-]+ \((?:critical|serious|moderate|minor|null|undefined)\): /i.test(t))
				out.add(t);
		}
	}
	return [...out];
}

/**
 * The accessibility matrix: every route in the axe titles x {keyless, keyed} x {root, sub}.
 * @param {any} report Playwright JSON report (or null when missing)
 */
export function a11yMatrix(report) {
	const tests = e2eTests(report);
	/** @type {Map<string, Record<string, { status: string; violations: string[]; note?: string }>>} */
	const routes = new Map();
	for (const t of tests ?? []) {
		const m = AXE_KEYLESS.exec(t.title) ?? AXE_KEYED.exec(t.title);
		if (!m || !['root', 'sub'].includes(t.project)) continue;
		let route;
		try {
			route = JSON.parse(m[1]);
		} catch {
			continue;
		}
		const col = `${AXE_KEYED.test(t.title) ? 'keyed' : 'keyless'}/${t.project}`;
		if (!routes.has(route)) routes.set(route, {});
		const cells = routes.get(route);
		const prev = cells[col];
		const failed = t.outcome !== 'pass' || prev?.status === FAIL;
		cells[col] = {
			status: failed ? FAIL : PASS,
			violations: [...new Set([...(prev?.violations ?? []), ...violationLines(t.errors)])],
			...(t.outcome === 'skip' ? { note: 'skipped' } : {})
		};
	}
	const rows = [...routes].map(([route, cells]) => {
		for (const [col] of A11Y_COLUMNS) {
			cells[col] ??= { status: FAIL, violations: [], note: 'not run' };
		}
		return { route, cells };
	});
	const state = (prefix) =>
		rows.length > 0 &&
		rows.every((r) =>
			A11Y_COLUMNS.every(([c]) => !c.startsWith(prefix) || r.cells[c].status === PASS)
		)
			? PASS
			: FAIL;
	const extras = EXTRA_A11Y.map((g) => ({
		name: g.name,
		tests: 0,
		failed: 0,
		passed: 0,
		required: g.required
	}));
	for (const t of tests ?? []) {
		if (!/\baxe\b/i.test(t.title) || AXE_KEYLESS.test(t.title) || AXE_KEYED.test(t.title)) continue;
		const i = EXTRA_A11Y.findIndex((g) => g.match.test(t.key));
		if (i === -1) continue;
		extras[i].tests++;
		if (t.outcome === 'fail') extras[i].failed++;
		if (t.outcome === 'pass') extras[i].passed++;
	}
	const extraRows = extras.map((x) => ({
		...x,
		status:
			tests === null ? FAIL : x.failed > 0 ? FAIL : x.passed > 0 ? PASS : x.required ? FAIL : NA
	}));
	return {
		missing: tests === null,
		rows,
		extras: extraRows,
		keyless: state('keyless') === PASS && extraRows.every((x) => x.status !== FAIL) ? PASS : FAIL,
		keyed: state('keyed')
	};
}

/** Disclaimer rows from the `disclaimer: <name>` E2E results. */
export function disclaimerRows(data) {
	const tests = e2eTests(data.e2eReport);
	const required = new Map((data.disclaimers ?? []).map((d) => [d.name, d.text]));
	/** @type {Map<string, { pass: number; fail: number }>} */
	const seen = new Map();
	for (const t of tests ?? []) {
		if (!t.title.startsWith(DISCLAIMER_PREFIX)) continue;
		const name = t.title.slice(DISCLAIMER_PREFIX.length);
		const s = seen.get(name) ?? { pass: 0, fail: 0 };
		if (t.outcome === 'pass') s.pass++;
		else s.fail++;
		seen.set(name, s);
	}
	const names = [...new Set([...required.keys(), ...seen.keys()])];
	return names.map((name) => {
		const s = seen.get(name);
		return {
			name,
			text: required.get(name) ?? `(see ${DISCLAIMER_SPEC})`,
			status: s && s.fail === 0 && s.pass > 0 ? PASS : FAIL,
			note: !s ? 'not run' : ''
		};
	});
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/** Performance rows for PERF_ROUTES with the landing CLS merged in. */
export function perfRows(data) {
	const rows = data.budget?.rows ?? [];
	const cls = data.cls;
	return PERF_ROUTES.map((page) => {
		const route = page.replace(/index\.html$/, '');
		const r = rows.find((x) => x.route === page);
		const clsRows = (cls ?? []).filter((c) => c.route === route);
		const first = clsRows.filter((c) => c.state === 'first-visit').map((c) => c.cls);
		const isLanding = page === 'index.html';
		let clsText = '-';
		let clsOk = true;
		if (isLanding) {
			if (!cls || first.length === 0) {
				clsText = 'missing';
				clsOk = false;
			} else {
				clsText = Math.max(...first).toFixed(3);
				clsOk = clsRows.every((c) => typeof c.cls === 'number' && c.cls < CLS_LIMIT);
			}
		} else if (first.length) {
			clsText = Math.max(...first).toFixed(3);
			clsOk = clsRows.every((c) => typeof c.cls === 'number' && c.cls < CLS_LIMIT);
		}
		const jsOk = r ? r.jsGz <= BUDGET_BYTES && r.result !== 'FAIL' : false;
		return {
			route: `/${route}`,
			js: r ? kb(r.jsGz) : 'not built',
			budget: `${BUDGET_BYTES / 1024} KB`,
			css: r ? kb(r.cssGz) : '-',
			cls: clsText,
			status: jsOk && clsOk ? PASS : FAIL
		};
	});
}

export function cspStatus(csp) {
	const targets = csp?.targets ?? [];
	const pages = csp?.pages ?? [];
	return targets.length > 0 &&
		targets.every((t) => t.errors.length === 0) &&
		pages.length > 0 &&
		pages.every((p) => p.metaFirst && p.unsafeInline.every((d) => d === 'style-src-attr'))
		? PASS
		: FAIL;
}

/**
 * The nine Summary rows (UI-SPEC order).
 * @param {any} data
 */
export function summaryRows(data) {
	const a11y = a11yMatrix(data.e2eReport);
	const e2eMissing = data.e2eReport ? '' : ' (report missing)';
	const disc = disclaimerRows(data);
	const perf = perfRows(data);
	const pits = pitfallRows(data);
	const cover = uncoveredPitfalls(data.pitfalls ?? [], data.evidence ?? PITFALLS_EVIDENCE);
	const seoTargets = data.seo?.targets ?? [];
	const ev = (f, extra = '') => `${EVIDENCE_DIR}${f}${extra}`;
	return [
		['axe (keyless)', '`pnpm test:e2e`', a11y.keyless, ev('a11y.txt', e2eMissing)],
		['axe (mocked key)', '`pnpm test:e2e`', a11y.keyed, ev('a11y.txt', e2eMissing)],
		['CSP review', '`pnpm csp:assert`', cspStatus(data.csp), ev('csp.txt')],
		[
			'Dependency audit',
			'`pnpm audit --json --audit-level low`',
			data.deps && data.deps.exitCode === 0 ? PASS : FAIL,
			ev('deps.txt', data.deps ? '' : ' (not run)')
		],
		[
			'Banned terms',
			'`pnpm banned`',
			data.banned && data.banned.files > 0 && data.banned.hits.length === 0 ? PASS : FAIL,
			ev('banned.txt')
		],
		[
			'Disclaimer presence',
			'`pnpm test:e2e disclaimers`',
			data.e2eReport && disc.length > 0 && disc.every((d) => d.status === PASS) ? PASS : FAIL,
			ev('disclaimers.txt', e2eMissing)
		],
		[
			'Performance budget',
			'`node scripts/assert-budget.mjs apps/web/build`',
			perf.every((r) => r.status === PASS) && (data.budget?.errors ?? ['not run']).length === 0
				? PASS
				: FAIL,
			ev('budget.txt', data.cls ? '' : ' (CLS report missing)')
		],
		[
			'Sitemap/robots/OG',
			'`node scripts/assert-seo.mjs <build> --target <t>`',
			seoTargets.length > 0 && seoTargets.every((t) => t.errors.length === 0) ? PASS : FAIL,
			ev('seo.txt')
		],
		[
			'PITFALLS checklist',
			'`pnpm audit:launch`',
			pits.length > 0 &&
			pits.every((p) => p.status !== FAIL) &&
			cover.missing.length === 0 &&
			cover.stale.length === 0
				? PASS
				: FAIL,
			ev('pitfalls.txt', e2eMissing || (data.unitReport ? '' : ' (report missing)'))
		]
	].map(([check, command, result, evidence], i) => ({
		n: i + 1,
		check,
		command,
		result,
		evidence
	}));
}

// ---------------------------------------------------------------------------------------------
// Rendering (pure)
// ---------------------------------------------------------------------------------------------

const cell = (s) =>
	String(s ?? '')
		.replace(/\|/g, '\\|')
		.replace(/\r?\n/g, ' ');
const row = (cells) => `| ${cells.map(cell).join(' | ')} |`;
const table = (header, rows) => [
	row(header),
	`|${header.map(() => '---').join('|')}|`,
	...rows.map(row)
];
const fence = (text) => ['```text', String(text ?? '').trimEnd() || '(empty)', '```'];

/**
 * The full docs/LAUNCH-AUDIT.md text.
 * @param {any} data collect() output (or an equivalent fixture)
 * @returns {string}
 */
export function renderAudit(data) {
	const h = data.header ?? {};
	const a11y = a11yMatrix(data.e2eReport);
	const out = [
		'# Launch audit',
		'',
		`<!-- Generated by \`pnpm audit:launch\` (scripts/launch-audit.mjs). Do not edit by hand. -->`,
		'',
		`- Date: ${h.date ?? ''}`,
		`- Commit: ${h.commit ?? ''}`,
		`- Base URL audited: ${h.baseUrl ?? ''}`,
		`- Build command: \`${h.buildCommand ?? BUILD_COMMAND}\``,
		`- Node: ${h.node ?? ''}`,
		`- pnpm: ${h.pnpm ?? ''}`,
		'',
		'Status words: PASS, FAIL, N/A, DEFERRED (human). Raw outputs are under `docs/audit/`.',
		'',
		'## Summary',
		'',
		...table(
			['#', 'Check', 'Command', 'Result', 'Evidence'],
			summaryRows(data).map((r) => [r.n, r.check, r.command, r.result, r.evidence])
		),
		'',
		'## Accessibility',
		'',
		'axe-core with tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa; zero violations required.',
		''
	];
	if (a11y.missing) out.push(`No axe results: Playwright report missing (${E2E_REPORT}).`, '');
	else if (a11y.rows.length === 0)
		out.push('No axe route results found in the Playwright report.', '');
	else {
		out.push(
			...table(
				['Route', ...A11Y_COLUMNS.map(([, l]) => l), 'Violations'],
				a11y.rows.map((r) => [
					r.route === '' ? '/' : `/${r.route}`,
					...A11Y_COLUMNS.map(([c]) => r.cells[c].status),
					A11Y_COLUMNS.reduce((n, [c]) => n + r.cells[c].violations.length, 0)
				])
			),
			''
		);
		const failing = a11y.rows.flatMap((r) =>
			A11Y_COLUMNS.filter(([c]) => r.cells[c].status === FAIL).map(
				([c, l]) =>
					`- ${r.route === '' ? '/' : `/${r.route}`}, ${l}: ${r.cells[c].note ?? (r.cells[c].violations.join('; ') || 'test failed')}`
			)
		);
		if (failing.length) out.push('Failing cells:', '', ...failing, '');
	}
	out.push(
		'Extra states (Accessibility Contract):',
		'',
		...table(
			['State', 'Tests', 'Result'],
			a11y.extras.map((x) => [
				x.name,
				`${x.passed} passed, ${x.failed} failed of ${x.tests}`,
				x.status
			])
		),
		'',
		'## CSP review',
		''
	);
	const csp = data.csp ?? { targets: [], pages: [] };
	out.push(
		...table(
			['Target', 'Build', 'Pages', 'Faults', 'Result'],
			csp.targets.map((t) => [
				t.target,
				t.dir,
				t.pages,
				t.errors.length,
				t.errors.length ? FAIL : PASS
			])
		),
		'',
		'Expected directives (exact): ' +
			Object.entries(EXACT)
				.map(([k, v]) => `\`${k} ${v.join(' ')}\``)
				.join(', ') +
			"; `script-src` only 'self' and sha256 hashes; `style-src 'self'`; `style-src-attr 'unsafe-inline'`.",
		''
	);
	for (const p of csp.pages) {
		out.push(
			`### ${p.file}`,
			'',
			...fence(p.policy),
			'',
			`- CSP meta first in head: ${p.metaFirst ? 'yes' : 'no'} (${p.metaFirst ? PASS : FAIL})`,
			`- 'unsafe-inline' in: ${p.unsafeInline.length ? p.unsafeInline.join(', ') : 'none'} (${p.unsafeInline.every((d) => d === 'style-src-attr') ? PASS : FAIL}; allowed only in style-src-attr)`,
			`- connect-src: ${p.connectSrc.join(' ')}`,
			`- Analytics host: ${p.analyticsHost ? `${p.analyticsHost} (in connect-src: ${p.connectSrc.includes(p.analyticsHost) ? 'yes' : 'no'})` : 'none (connect-src without an analytics host)'}`,
			''
		);
	}
	const deps = data.deps;
	out.push(
		'## Dependency audit',
		'',
		`Exit code: ${deps ? deps.exitCode : 'not run'}`,
		'',
		...fence(deps?.summary ?? 'not run'),
		''
	);
	const exc = deps?.exceptions ?? AUDIT_EXCEPTIONS;
	if (exc.length === 0) out.push('No exceptions.', '');
	else {
		out.push(
			...table(
				['Advisory', 'Package', 'Severity', 'Path', 'Why accepted', 'Revisit by'],
				exc.map((e) => [e.ghsa, e.package, e.severity, e.path, e.why, e.revisitBy])
			),
			''
		);
	}
	const banned = data.banned ?? { files: 0, hits: [] };
	out.push(
		'## Copy compliance',
		'',
		`Banned terms: ${banned.files} files scanned, ${banned.hits.length} matches.`,
		'',
		...(banned.hits.length ? [...banned.hits.map((h) => `- ${h}`), ''] : []),
		...(data.e2eReport
			? []
			: [`Disclaimer results: Playwright report missing (${E2E_REPORT}).`, '']),
		...table(
			['Route or export', 'Required text', 'Present'],
			disclaimerRows(data).map((d) => [d.name, d.text, d.status])
		),
		'',
		'## Performance budget',
		'',
		...table(
			['Route', 'JS (gz)', 'Budget', 'CSS (gz)', 'CLS (first visit)', 'Result'],
			perfRows(data).map((r) => [r.route, r.js, r.budget, r.css, r.cls, r.status])
		),
		'',
		`Initial JS at gzip -9 from the built HTML (\`apps/web/build\`); tools pages are gated at ${BUDGET_BYTES / 1024} KB and the landing is reported against the same budget. CLS from \`${CLS_REPORT}\` (every row must be below ${CLS_LIMIT}).`,
		''
	);
	if (data.cls) {
		out.push(
			...data.cls.map(
				(c) => `- /${c.route} ${c.viewport} ${c.state}: CLS ${Number(c.cls).toFixed(3)}`
			),
			''
		);
	} else out.push(`CLS report missing (${CLS_REPORT}).`, '');
	if (data.budget?.errors?.length) out.push(...data.budget.errors.map((e) => `- ${e}`), '');
	const seo = data.seo ?? { targets: [], sitemap: [], robots: '', og: [] };
	out.push(
		'## SEO artifacts',
		'',
		...table(
			['Target', 'Build', 'Sitemap URLs', 'Faults', 'Result'],
			seo.targets.map((t) => [
				t.target,
				t.dir,
				t.urls,
				t.errors.length,
				t.errors.length ? FAIL : PASS
			])
		),
		'',
		`Sitemap (${seo.sitemap.length} URLs):`,
		'',
		...seo.sitemap.map((u) => `- ${u}`),
		'',
		'robots.txt:',
		'',
		...fence(seo.robots),
		'',
		...table(
			['OG image', 'Size', 'Dimensions'],
			seo.og.map((o) => [o.file, kb(o.bytes), `${o.width} x ${o.height}`])
		),
		'',
		`## "Looks Done But Isn't" checklist`,
		'',
		'Every item of .planning/research/PITFALLS.md, verbatim. Evidence is declared in `scripts/lib/pitfalls-evidence.mjs` and evaluated against the reports.',
		'',
		...table(
			['#', 'Item', 'Status', 'Evidence'],
			pitfallRows(data).map((p, i) => [i + 1, p.line, p.status, p.evidence])
		),
		'',
		'## Human UAT (deferred)',
		'',
		'Owner-only checks. Each is DEFERRED (human) until recorded.',
		'',
		...HUMAN_UAT.map(
			(s, i) =>
				`${i + 1}. **${s.title}.** ${s.step} Status: ${DEFERRED}. Record result in ${HUMAN_UAT_FILE}.`
		),
		'',
		'## Sign-off',
		'',
		'- Audited by:',
		'- Date:',
		'- Notes:',
		''
	);
	return out.join('\n');
}

/**
 * True when any Summary row is FAIL (or the Summary cannot be found: fail closed).
 * @param {string} md
 */
export function auditFailed(md) {
	const start = md.indexOf('\n## Summary');
	if (start === -1) return true;
	const rest = md.slice(start + 1);
	const end = rest.indexOf('\n## ');
	const rows = (end === -1 ? rest : rest.slice(0, end))
		.split('\n')
		.filter((l) => /^\| \d+ \|/.test(l))
		.map((l) => l.split(/(?<!\\)\|/).map((c) => c.trim()));
	return rows.length === 0 || rows.some((c) => c[4] !== PASS);
}

/** Raw evidence files written under docs/audit/. */
export function evidenceFiles(data) {
	const a11y = a11yMatrix(data.e2eReport);
	const lines = (xs) => xs.join('\n') + '\n';
	return {
		'a11y.txt': lines([
			a11y.missing
				? `Playwright report missing: ${E2E_REPORT}`
				: `Playwright report: ${E2E_REPORT}`,
			...a11y.rows.flatMap((r) =>
				A11Y_COLUMNS.map(
					([c]) =>
						`${r.route === '' ? '/' : `/${r.route}`}\t${c}\t${r.cells[c].status}\t${r.cells[c].note ?? ''}\t${r.cells[c].violations.join('; ')}`
				)
			),
			...a11y.extras.map((x) => `extra\t${x.name}\t${x.status}\t${x.passed}/${x.tests} passed`)
		]),
		'csp.txt': lines([
			...(data.csp?.targets ?? []).flatMap((t) => [
				`${t.target} ${t.dir}: ${t.pages} pages, ${t.errors.length} faults`,
				...t.errors.map((e) => `  - ${e}`)
			]),
			...(data.csp?.pages ?? []).map((p) => `${p.file}: ${p.policy}`)
		]),
		'deps.txt': lines([
			`exit code: ${data.deps?.exitCode ?? 'not run'}`,
			data.deps?.raw ?? data.deps?.summary ?? ''
		]),
		'banned.txt': lines([
			`${data.banned?.files ?? 0} files scanned, ${data.banned?.hits.length ?? 0} matches`,
			...(data.banned?.hits ?? [])
		]),
		'disclaimers.txt': lines(
			disclaimerRows(data).map((d) => `${d.status}\t${d.name}\t${d.text}\t${d.note}`)
		),
		'budget.txt': lines([
			...(data.budget?.rows ?? []).map(
				(r) => `${r.route}\tjs ${r.jsGz}\tcss ${r.cssGz}\t${r.result}`
			),
			...(data.budget?.errors ?? []).map((e) => `error: ${e}`),
			data.cls ? `cls: ${JSON.stringify(data.cls)}` : `CLS report missing: ${CLS_REPORT}`
		]),
		'seo.txt': lines([
			...(data.seo?.targets ?? []).flatMap((t) => [
				`${t.target} ${t.dir}: ${t.urls} URLs, ${t.errors.length} faults`,
				...t.errors.map((e) => `  - ${e}`)
			])
		]),
		'pitfalls.txt': lines([
			...Object.entries(data.commands ?? {}).map(
				([id, c]) => `command ${id}: exit ${c.exitCode}\n${String(c.output ?? '').trimEnd()}`
			),
			...pitfallRows(data).map((p) => `${p.status}\t${p.label}\t${p.evidence}`)
		])
	};
}

// ---------------------------------------------------------------------------------------------
// Collection (side effects: reads builds and reports, spawns command gates)
// ---------------------------------------------------------------------------------------------

/** The pinned pnpm: the one that invoked this script, else corepack (build-web.mjs rule). */
function pnpmSpawn(args, opts = {}) {
	const execPath = process.env.npm_execpath;
	const [bin, pre] = execPath ? [process.execPath, [execPath]] : ['corepack', ['pnpm']];
	const shell = !execPath && process.platform === 'win32';
	return spawnSync(bin, [...pre, ...args], { encoding: 'utf8', shell, ...opts });
}

const readJson = (file) => {
	if (!existsSync(file)) return null;
	try {
		return JSON.parse(readFileSync(file, 'utf8'));
	} catch {
		return null;
	}
};

/** CSP meta facts for one built page. */
export function cspFacts(file, html, analyticsHost) {
	const head = (/<head>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '');
	const tags = [...head.matchAll(/<([a-z]+)\b[^>]*>/gi)].map((m) => m[0]);
	const i = tags.findIndex((t) => /http-equiv="content-security-policy"/i.test(t));
	const before = i === -1 ? [] : tags.slice(0, i);
	const policy =
		i === -1 ? '' : (/content="([^"]*)"/i.exec(tags[i])?.[1] ?? '').replace(/&#39;|&apos;/g, "'");
	const directives = policy
		.split(';')
		.map((d) => d.trim().split(/\s+/))
		.filter((d) => d[0]);
	return {
		file,
		policy: policy || '(CSP meta missing)',
		metaFirst:
			i !== -1 &&
			(before.length === 0 || (before.length === 1 && /^<meta charset=/i.test(before[0]))),
		unsafeInline: directives.filter((d) => d.includes("'unsafe-inline'")).map((d) => d[0]),
		connectSrc: directives.find((d) => d[0] === 'connect-src')?.slice(1) ?? [],
		analyticsHost
	};
}

function pngDims(buf) {
	if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return { width: 0, height: 0 };
	return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Parses `name: '...'` / `text: '...'` pairs from the disclaimer spec's DISCLAIMER_CHECKS. */
function disclaimerChecks(root) {
	const file = join(root, DISCLAIMER_SPEC);
	if (!existsSync(file)) return [];
	const src = readFileSync(file, 'utf8');
	const out = [];
	for (const m of src.matchAll(
		/\{[^{}]*?\bname:\s*(['"`])(.+?)\1[^{}]*?\btext:\s*(['"`])(.+?)\3[^{}]*?\}/gs
	)) {
		out.push({ name: m[2], text: m[4] });
	}
	return out;
}

/**
 * Gathers every gate result for the audit.
 * @param {{ root: string; env?: Record<string, string | undefined> }} opts
 */
export function collect({ root, env = process.env }) {
	const git = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' });
	const rootEnv = { ...env, ...targetEnv('root', env) };
	const origin = resolveSiteOrigin(rootEnv);
	const header = {
		date: new Date().toISOString(),
		commit: (git.stdout ?? '').trim() || 'unknown',
		baseUrl: `${origin}/ (root build); ${origin}/tran_real_estate/ (sub-path build)`,
		buildCommand: BUILD_COMMAND,
		node: process.version,
		pnpm: (pnpmSpawn(['--version'], { cwd: root }).stdout ?? '').trim() || 'unknown'
	};

	/** @type {Record<string, { exitCode: number | null; output: string }>} */
	const commands = {};

	// CSP: the oracle over all three builds, plus the emitted meta of one marketing and one app page.
	const targets = TARGETS.map((t) => {
		const tEnv = { ...env, ...targetEnv(t, env) };
		const dir = `apps/web/${tEnv.BUILD_DIR}`;
		const { host } = resolveAnalytics(tEnv);
		return {
			target: t,
			dir,
			host,
			errors: checkBuild(join(root, dir), { analyticsHost: host }),
			pages: countPages(join(root, dir))
		};
	});
	const rootHost = targets[0].host;
	const pages = ['index.html', 'renter/index.html']
		.filter((f) => existsSync(join(root, 'apps/web/build', f)))
		.map((f) => cspFacts(f, readFileSync(join(root, 'apps/web/build', f), 'utf8'), rootHost));
	const csp = {
		targets: targets.map((t) => ({
			target: t.target,
			dir: t.dir,
			errors: t.errors,
			pages: t.pages
		})),
		pages
	};
	commands.csp = {
		exitCode: targets.every((t) => t.errors.length === 0) ? 0 : 1,
		output: targets.flatMap((t) => t.errors).join('\n')
	};

	// SEO: the oracle on the root and sub-path builds, plus the artifacts themselves.
	const seoTargets = ['root', 'sub'].map((t) => {
		const tEnv = { ...env, ...targetEnv(t, env) };
		const dir = `apps/web/${tEnv.BUILD_DIR}`;
		const siteUrl = resolveSiteOrigin(tEnv) + resolveBasePath(tEnv);
		const errors = checkSeo(join(root, dir), { siteUrl, minUrls: 14 });
		const sm = join(root, dir, 'sitemap.xml');
		const urls = existsSync(sm)
			? [...readFileSync(sm, 'utf8').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1])
			: [];
		return { target: t, dir, errors, urls: urls.length, list: urls };
	});
	const ogDir = join(root, 'apps/web/build/og');
	const og = existsSync(ogDir)
		? readdirSync(ogDir)
				.filter((f) => f.endsWith('.png'))
				.sort()
				.map((f) => {
					const buf = readFileSync(join(ogDir, f));
					return { file: `og/${f}`, bytes: buf.length, ...pngDims(buf) };
				})
		: [];
	const robotsFile = join(root, 'apps/web/build/robots.txt');
	const seo = {
		targets: seoTargets.map((t) => ({
			target: t.target,
			dir: t.dir,
			errors: t.errors,
			urls: t.urls
		})),
		sitemap: seoTargets[0].list,
		robots: existsSync(robotsFile) ? readFileSync(robotsFile, 'utf8') : '(robots.txt missing)',
		og
	};
	commands.seo = {
		exitCode: seoTargets.every((t) => t.errors.length === 0) ? 0 : 1,
		output: seoTargets.flatMap((t) => t.errors).join('\n')
	};

	const budget = checkBudget(join(root, 'apps/web/build'));
	commands.budget = { exitCode: budget.errors.length ? 1 : 0, output: budget.errors.join('\n') };

	const files = collectFiles(root);
	const hits = files.flatMap((rel) => findBanned(rel, readFileSync(join(root, rel), 'utf8')));
	const banned = { files: files.length, hits };
	commands.banned = {
		exitCode: files.length > 0 && hits.length === 0 ? 0 : 1,
		output: hits.join('\n')
	};

	const audit = pnpmSpawn(['audit', '--json', '--audit-level', 'low'], {
		cwd: root,
		maxBuffer: 64 * 1024 * 1024
	});
	let summary = (audit.stdout || audit.stderr || '').slice(0, 2000);
	try {
		const v = JSON.parse(audit.stdout).metadata?.vulnerabilities;
		if (v)
			summary = Object.entries(v)
				.map(([k, n]) => `${k}: ${n}`)
				.join(', ');
	} catch {
		// keep the raw head
	}
	const deps = {
		exitCode: audit.status,
		summary,
		raw: audit.stdout || audit.stderr || '',
		exceptions: AUDIT_EXCEPTIONS
	};
	commands.deps = { exitCode: audit.status, output: summary };

	for (const g of COMMAND_GATES) {
		if (!g.run) continue;
		const [bin, ...args] = g.run;
		const r = spawnSync(bin === 'node' ? process.execPath : bin, args, {
			cwd: root,
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024
		});
		commands[g.id] = {
			exitCode: r.status,
			output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}`
		};
	}

	return {
		header,
		e2eReport: readJson(join(root, E2E_REPORT)),
		unitReport: readJson(join(root, UNIT_REPORT)),
		cls: readJson(join(root, CLS_REPORT)),
		commands,
		csp,
		seo,
		budget,
		banned,
		deps,
		pitfalls: parsePitfallsChecklist(
			readFileSync(join(root, '.planning/research/PITFALLS.md'), 'utf8')
		),
		disclaimers: disclaimerChecks(root)
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const root = join(import.meta.dirname, '..');
	const data = collect({ root });
	const md = renderAudit(data);
	if (process.argv.includes('--write')) {
		mkdirSync(join(root, EVIDENCE_DIR), { recursive: true });
		for (const [f, text] of Object.entries(evidenceFiles(data))) {
			writeFileSync(join(root, EVIDENCE_DIR, f), text);
		}
		writeFileSync(join(root, AUDIT_DOC), md);
		console.log(`Wrote ${AUDIT_DOC} and ${EVIDENCE_DIR}*.txt`);
	} else {
		console.log(md);
	}
	const failed = summaryRows(data).filter((r) => r.result === FAIL);
	if (failed.length) {
		console.error(
			`Launch audit: ${failed.length} Summary row(s) FAIL: ${failed.map((r) => r.check).join(', ')}`
		);
		process.exit(1);
	}
	console.log('Launch audit: every Summary row PASS');
}
