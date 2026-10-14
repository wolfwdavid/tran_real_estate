// Tests for the launch-audit generator (10-22). Part 1: the PITFALLS "Looks Done But Isn't"
// checklist is parsed from the real research file and every item must have declared evidence.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { AUDIT_EXCEPTIONS } from './lib/audit-exceptions.mjs';
import { HUMAN_UAT, PITFALLS_EVIDENCE } from './lib/pitfalls-evidence.mjs';
import {
	COMMAND_GATES,
	a11yMatrix,
	auditFailed,
	evidenceMapErrors,
	parsePitfallsChecklist,
	oversizeReportRows,
	pitfallLabel,
	renderAudit,
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

// ---------------------------------------------------------------------------------------------
// Part 2: collector output -> Markdown. All fixture data is in memory; nothing is spawned.
// ---------------------------------------------------------------------------------------------

type PwSpec = { file: string; title: string; project?: string; ok?: boolean; error?: string };
type UnitCase = { file: string; title: string; ok?: boolean };

/** A Playwright JSON report (reporter=json) holding the given specs, grouped by file. */
function pwReport(specs: PwSpec[]) {
	const files = [...new Set(specs.map((s) => s.file))];
	return {
		suites: files.map((file) => ({
			title: file,
			file,
			specs: specs
				.filter((s) => s.file === file)
				.map((s) => ({
					title: s.title,
					file,
					tests: [
						{
							projectName: s.project ?? 'root',
							status: s.ok === false ? 'unexpected' : 'expected',
							results: [
								{
									status: s.ok === false ? 'failed' : 'passed',
									errors: s.error ? [{ message: s.error }] : []
								}
							]
						}
					]
				})),
			suites: []
		}))
	};
}

/** A Vitest JSON report (reporter=json) holding the given cases. */
function vitestReport(cases: UnitCase[]) {
	const files = [...new Set(cases.map((c) => c.file))];
	return {
		testResults: files.map((file) => ({
			name: `C:\\repo\\${file.replace(/\//g, '\\')}`,
			assertionResults: cases
				.filter((c) => c.file === file)
				.map((c) => ({
					ancestorTitles: [],
					title: c.title,
					fullName: c.title,
					status: c.ok === false ? 'failed' : 'passed',
					failureMessages: c.ok === false ? ['boom'] : []
				}))
		}))
	};
}

const ROUTES2 = ['', 'tools/'];
const AXE = (r: string) => `axe reports no WCAG A/AA violations on ${JSON.stringify(r)}`;
const AXE_KEYED = (r: string) =>
	`axe (keyed) reports no WCAG A/AA violations on ${JSON.stringify(r)}`;

function axeSpecs(failKeyed?: { route: string; project: string; error: string }): PwSpec[] {
	const out: PwSpec[] = [];
	for (const project of ['root', 'sub']) {
		for (const route of ROUTES2) {
			out.push({ file: 'a11y.spec.ts', title: AXE(route), project });
			const fail = failKeyed && failKeyed.route === route && failKeyed.project === project;
			out.push({
				file: 'a11y-keyed.spec.ts',
				title: AXE_KEYED(route),
				project,
				ok: !fail,
				error: fail ? failKeyed.error : undefined
			});
		}
	}
	for (const t of [
		'axe reports no WCAG A/AA violations at 375px on ""',
		'axe on the guide at step 0',
		'axe on each calculator in the example state',
		'axe on the waitlist form in the error state',
		'axe on /setup/rentcast/ with a tested key'
	]) {
		out.push({ file: 'extra.spec.ts', title: t });
	}
	return out;
}

/** Passing tests for every 'auto' evidence row, so the base fixture is all PASS. */
function evidenceFixtures() {
	const e2e: PwSpec[] = [];
	const unit: UnitCase[] = [];
	for (const entry of Object.values(PITFALLS_EVIDENCE) as {
		evidence?: { type: string; match: string }[];
	}[]) {
		for (const ev of entry.evidence ?? []) {
			const isFile = /\.(test|spec)\.ts$/.test(ev.match);
			if (ev.type === 'e2e') {
				e2e.push(
					isFile ? { file: ev.match, title: 'works' } : { file: 'x.spec.ts', title: ev.match }
				);
			}
			if (ev.type === 'unit') {
				unit.push(
					isFile ? { file: ev.match, title: 'works' } : { file: 'pkg/x.test.ts', title: ev.match }
				);
			}
		}
	}
	return { e2e, unit };
}

const ALL_COMMANDS = Object.fromEntries(
	COMMAND_GATES.map((g: { id: string }) => [g.id, { exitCode: 0, output: 'ok' }])
);
const CALCS = ['affordability', 'cap-rate', 'cash-on-cash', 'dscr'];
const DISCLAIMER_SPECS: PwSpec[] = [
	{ file: 'disclaimers.spec.ts', title: 'disclaimer: footer' },
	{ file: 'disclaimers.spec.ts', title: 'disclaimer: deal analyzer' }
];

function baseData(over: Record<string, unknown> = {}) {
	const ev = evidenceFixtures();
	return {
		header: {
			date: '2026-10-13',
			commit: 'abc1234',
			baseUrl: 'https://tranrealestate.github.io/',
			buildCommand: 'pnpm build:root && pnpm build:sub && pnpm build:configured',
			node: 'v24.21.0',
			pnpm: '11.27.0'
		},
		e2eReport: pwReport([...axeSpecs(), ...ev.e2e, ...DISCLAIMER_SPECS]),
		unitReport: vitestReport(ev.unit),
		commands: { ...ALL_COMMANDS },
		csp: {
			targets: [
				{ target: 'root', dir: 'apps/web/build', errors: [] as string[], pages: 40 },
				{ target: 'sub', dir: 'apps/web/build-sub', errors: [] as string[], pages: 40 }
			],
			pages: [
				{
					file: 'index.html',
					policy:
						"default-src 'self'; connect-src 'self' https://api.rentcast.io; style-src-attr 'unsafe-inline'",
					metaFirst: true,
					unsafeInline: ['style-src-attr'],
					connectSrc: ["'self'", 'https://api.rentcast.io'],
					analyticsHost: ''
				}
			]
		},
		seo: {
			targets: [{ target: 'root', dir: 'apps/web/build', errors: [] as string[], urls: 14 }],
			sitemap: ['https://tranrealestate.github.io/', 'https://tranrealestate.github.io/tools/'],
			robots: 'User-agent: *\nAllow: /\nSitemap: https://tranrealestate.github.io/sitemap.xml',
			og: [{ file: 'og/default.png', bytes: 51200, width: 1200, height: 630 }]
		},
		budget: {
			rows: [
				{ route: 'index.html', jsGz: 54000, cssGz: 9000, budget: null, result: 'REPORT' },
				{ route: 'tools/index.html', jsGz: 55000, cssGz: 9000, budget: 61440, result: 'PASS' },
				...CALCS.map((c) => ({
					route: `tools/${c}/index.html`,
					jsGz: 56000,
					cssGz: 9100,
					budget: 61440,
					result: 'PASS'
				}))
			],
			errors: [] as string[]
		},
		budgetConfigured: {
			rows: [
				{ route: 'feedback/index.html', jsGz: 50000, cssGz: 9000, budget: null, result: 'REPORT' },
				{ route: 'tools/index.html', jsGz: 55100, cssGz: 9000, budget: 61440, result: 'PASS' },
				...CALCS.map((c) => ({
					route: `tools/${c}/index.html`,
					jsGz: 56100,
					cssGz: 9100,
					budget: 61440,
					result: 'PASS'
				}))
			],
			errors: [] as string[]
		},
		cls: [
			{ route: '', viewport: '375x812', state: 'first-visit', cls: 0.01 },
			{ route: '', viewport: '1280x800', state: 'first-visit', cls: 0.02 },
			{ route: '', viewport: '375x812', state: 'returning', cls: 0 }
		],
		banned: { files: 120, hits: [] as string[] },
		deps: { exitCode: 0, summary: '0 vulnerabilities found', exceptions: AUDIT_EXCEPTIONS },
		pitfalls: parsePitfallsChecklist(PITFALLS_MD),
		disclaimers: [
			{ name: 'footer', text: 'not a real estate brokerage' },
			{ name: 'deal analyzer', text: 'General guidelines, not financial advice' }
		],
		...over
	};
}

const STATUS = new Set(['PASS', 'FAIL', 'N/A', 'DEFERRED (human)']);
const STATUS_HEADER = /^(Result|Status|Present|Keyless|Mocked key)/;

/** Every Markdown table as { header, rows } (cells trimmed). */
function tables(md: string) {
	const out: { header: string[]; rows: string[][] }[] = [];
	const lines = md.split('\n');
	const cells = (l: string) =>
		l
			.slice(1, -1)
			.split(/(?<!\\)\|/)
			.map((c) => c.trim());
	for (let i = 0; i < lines.length; i++) {
		if (!lines[i].startsWith('|') || !/^\|[\s:|-]+\|$/.test(lines[i + 1] ?? '')) continue;
		const header = cells(lines[i]);
		const rows: string[][] = [];
		for (i += 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(cells(lines[i]));
		out.push({ header, rows });
	}
	return out;
}

const SUMMARY_HEADER = '#|Check|Command|Result|Evidence';

function summary(md: string) {
	const t = tables(md).find((t) => t.header.join('|') === SUMMARY_HEADER);
	if (!t) throw new Error('no summary table');
	return Object.fromEntries(t.rows.map((r) => [r[1], { result: r[3], evidence: r[4] }]));
}

function pitfallTable(md: string) {
	const t = tables(md).find((t) => t.header.includes('Item'));
	if (!t) throw new Error('no pitfalls table');
	return t;
}

const pitfallStatus = (md: string, label: string) =>
	pitfallTable(md).rows.find((r) => r[1].startsWith(`**${label}:**`))?.[2];

describe('renderAudit', () => {
	test('sections and header block in order', () => {
		const md = renderAudit(baseData());
		const order = [
			'# Launch audit',
			'Date:',
			'Commit:',
			'Base URL audited:',
			'Build command:',
			'Node:',
			'pnpm:',
			'## Summary',
			'## Accessibility',
			'## CSP review',
			'## Dependency audit',
			'## Copy compliance',
			'## Performance budget',
			'## SEO artifacts',
			`## "Looks Done But Isn't" checklist`,
			'## Human UAT (deferred)',
			'## Sign-off'
		];
		let at = -1;
		for (const s of order) {
			const i = md.indexOf(s, at + 1);
			expect(i, s).toBeGreaterThan(at);
			at = i;
		}
		for (const s of ['Audited by:', 'Notes:']) expect(md).toContain(s);
	});

	test('summary table has the nine checks in order, all PASS on a green fixture', () => {
		const md = renderAudit(baseData());
		const t = tables(md).find((t) => t.header.join('|') === SUMMARY_HEADER);
		expect(t?.rows.map((r) => r[1])).toEqual([
			'axe (keyless)',
			'axe (mocked key)',
			'CSP review',
			'Dependency audit',
			'Banned terms',
			'Disclaimer presence',
			'Performance budget',
			'Sitemap/robots/OG',
			'PITFALLS checklist'
		]);
		expect(t?.rows.map((r) => r[3])).toEqual(Array(9).fill('PASS'));
		for (const r of t!.rows) expect(r[4]).toMatch(/docs\/audit\//);
		expect(auditFailed(md)).toBe(false);
	});

	test('every status cell is a status word and the output has no emoji', () => {
		for (const data of [baseData(), baseData({ e2eReport: null, unitReport: null, cls: null })]) {
			const md = renderAudit(data);
			for (const t of tables(md)) {
				t.header.forEach((h, i) => {
					if (!STATUS_HEADER.test(h)) return;
					for (const r of t.rows) expect(STATUS.has(r[i]), `${h}: ${r[i]}`).toBe(true);
				});
			}
			for (const ch of md) {
				const cp = ch.codePointAt(0)!;
				if (cp > 0x2fff) expect(cp).toBe(0x2212);
			}
		}
	});

	test('a failing keyed axe cell makes "axe (mocked key)" FAIL and keeps keyless PASS', () => {
		const error =
			'axe violations on "tools/":\ncolor-contrast (serious): Elements must meet minimum color contrast ratio thresholds';
		const e2e = pwReport([
			...axeSpecs({ route: 'tools/', project: 'sub', error }),
			...evidenceFixtures().e2e,
			...DISCLAIMER_SPECS
		]);
		const md = renderAudit(baseData({ e2eReport: e2e }));
		const s = summary(md);
		expect(s['axe (mocked key)'].result).toBe('FAIL');
		expect(s['axe (keyless)'].result).toBe('PASS');
		expect(md).toContain('color-contrast (serious)');
		expect(auditFailed(md)).toBe(true);
	});

	test('a missing Playwright report fails every dependent row with "report missing"', () => {
		const md = renderAudit(baseData({ e2eReport: null }));
		const s = summary(md);
		for (const k of [
			'axe (keyless)',
			'axe (mocked key)',
			'Disclaimer presence',
			'PITFALLS checklist'
		]) {
			expect(s[k].result, k).toBe('FAIL');
		}
		expect(s['axe (keyless)'].evidence).toContain('report missing');
		expect(pitfallStatus(md, 'Disclaimers')).toBe('FAIL');
	});

	test('auto pitfalls FAIL on a failing match and on no match; na and human keep their words', () => {
		const ev = evidenceFixtures();
		const unit = ev.unit.map((u) =>
			u.file === 'packages/core/src/budget/cap.test.ts' ? { ...u, ok: false } : u
		);
		const e2e = ev.e2e.filter((s) => s.title !== 'honeypot sends nothing but shows success');
		const md = renderAudit(
			baseData({
				unitReport: vitestReport(unit),
				e2eReport: pwReport([...axeSpecs(), ...e2e, ...DISCLAIMER_SPECS])
			})
		);
		expect(pitfallStatus(md, 'RentCast client')).toBe('FAIL');
		expect(pitfallStatus(md, 'Lead form')).toBe('FAIL');
		expect(md).toContain('no matching test');
		expect(pitfallStatus(md, 'Fair Housing linter')).toBe('PASS');
		expect(pitfallStatus(md, 'Extension')).toBe('N/A');
		expect(pitfallStatus(md, 'Pages deploy')).toBe('DEFERRED (human)');
		expect(summary(md)['PITFALLS checklist'].result).toBe('FAIL');
	});

	test('a failing or missing command gate fails its pitfall', () => {
		const md = renderAudit(
			baseData({ commands: { ...ALL_COMMANDS, 'secrets:canary': { exitCode: 1, output: 'x' } } })
		);
		expect(pitfallStatus(md, 'Secrets')).toBe('FAIL');
		const md2 = renderAudit(baseData({ commands: {} }));
		expect(pitfallStatus(md2, 'Fixtures')).toBe('FAIL');
		expect(md2).toContain('not run');
	});

	test('a match whose tests were all skipped is not a pass', () => {
		const report = vitestReport(evidenceFixtures().unit);
		for (const f of report.testResults) {
			if (f.name.endsWith('scheduler.test.ts')) {
				for (const a of f.assertionResults) a.status = 'skipped';
			}
		}
		const md = renderAudit(baseData({ unitReport: report }));
		expect(pitfallStatus(md, 'Saved-search alerts')).toBe('FAIL');
	});

	test('the checklist section reproduces every PITFALLS line verbatim, in order', () => {
		const md = renderAudit(baseData());
		const items = parsePitfallsChecklist(PITFALLS_MD);
		expect(pitfallTable(md).rows.map((r) => r[1])).toEqual(items);
		for (const line of items) expect(md).toContain(line);
	});

	test('dependency exceptions table, or "No exceptions."', () => {
		const md = renderAudit(baseData());
		expect(md).toContain('| Advisory | Package | Severity | Path | Why accepted | Revisit by |');
		expect(md).toContain(AUDIT_EXCEPTIONS[0].ghsa);
		const empty = renderAudit(baseData({ deps: { exitCode: 0, summary: 'none', exceptions: [] } }));
		expect(empty).toContain('No exceptions.');
		expect(empty).not.toContain('| Advisory |');
		const bad = renderAudit(baseData({ deps: { exitCode: 1, summary: '1 high', exceptions: [] } }));
		expect(summary(bad)['Dependency audit'].result).toBe('FAIL');
	});

	test('performance covers the landing, /tools/ and four calculators; a budget miss or missing CLS fails', () => {
		const md = renderAudit(baseData());
		const t = tables(md).find(
			(t) => t.header.join('|') === 'Route|JS (gz)|Budget|CSS (gz)|CLS (first visit)|Result'
		);
		expect(t?.rows.map((r) => r[0])).toEqual(['/', '/tools/', ...CALCS.map((c) => `/tools/${c}/`)]);
		expect(t?.rows[0][4]).toBe('0.020');
		const data = baseData();
		data.budget.rows[3] = { ...data.budget.rows[3], jsGz: 70000, result: 'FAIL' };
		data.budget.errors = ['tools/cap-rate/index.html: initial JS 68.4 KB gz exceeds the budget'];
		expect(summary(renderAudit(data))['Performance budget'].result).toBe('FAIL');
		const noCls = renderAudit(baseData({ cls: null }));
		expect(summary(noCls)['Performance budget'].result).toBe('FAIL');
		const missing = baseData();
		missing.budget.rows = missing.budget.rows.filter(
			(r: { route: string }) => r.route !== 'tools/dscr/index.html'
		);
		expect(summary(renderAudit(missing))['Performance budget'].result).toBe('FAIL');
	});

	test('the analytics-on build is gated too: a miss, an error or no measurement fails Performance', () => {
		const md = renderAudit(baseData());
		const t = tables(md).find((t) => t.header.join('|') === 'Route|JS (gz)|Budget|CSS (gz)|Result');
		expect(t?.rows.map((r) => r[0])).toEqual(['/tools/', ...CALCS.map((c) => `/tools/${c}/`)]);
		expect(t?.rows.every((r) => r[4] === 'PASS')).toBe(true);
		const over = baseData();
		over.budgetConfigured.rows[2] = {
			...over.budgetConfigured.rows[2],
			jsGz: 61500,
			result: 'FAIL'
		};
		over.budgetConfigured.errors = [
			'tools/cap-rate/index.html: initial JS 60.1 KB gz exceeds the 60 KB budget'
		];
		const overMd = renderAudit(over);
		expect(summary(overMd)['Performance budget'].result).toBe('FAIL');
		expect(overMd).toContain(
			'- tools/cap-rate/index.html: initial JS 60.1 KB gz exceeds the 60 KB budget'
		);
		expect(
			summary(renderAudit(baseData({ budgetConfigured: undefined })))['Performance budget'].result
		).toBe('FAIL');
		expect(
			summary(renderAudit(baseData({ budgetConfigured: { rows: [], errors: [] } })))[
				'Performance budget'
			].result
		).toBe('FAIL');
	});

	test('report-only pages over the budget are called out with size, cause and fix, without failing', () => {
		const none = renderAudit(baseData());
		expect(none).toContain('Report-only pages over the tool budget');
		expect(oversizeReportRows(baseData())).toEqual([]);
		const d = baseData();
		d.budget.rows.push({
			route: 'for-renters/index.html',
			jsGz: 98611,
			cssGz: 9000,
			budget: null,
			result: 'REPORT'
		});
		d.budgetConfigured.rows[0] = { ...d.budgetConfigured.rows[0], jsGz: 104960 };
		const rows = oversizeReportRows(d);
		expect(
			rows.map((r: { route: string; build: string; js: string; over: string }) => [
				r.route,
				r.build,
				r.js,
				r.over
			])
		).toEqual([
			['/for-renters/', 'apps/web/build', '96.3 KB', '36.3 KB'],
			['/feedback/', 'apps/web/build-configured', '102.5 KB', '42.5 KB']
		]);
		for (const r of rows) {
			expect(r.cause).not.toBe('Not yet analysed.');
			expect(r.fix.length).toBeGreaterThan(20);
		}
		const md = renderAudit(d);
		const t = tables(md).find(
			(t) => t.header[0] === 'Route' && t.header.includes('Recommendation')
		);
		expect(t?.rows).toHaveLength(2);
		expect(summary(md)['Performance budget'].result).toBe('PASS');
		expect(md).toContain('Report-only pages over the JS budget (owner decision)');
	});

	test('CSP, banned terms, SEO and disclaimers fail from their real results', () => {
		const d = baseData();
		d.csp.targets[0].errors = ['index.html: CSP meta missing'];
		expect(summary(renderAudit(d))['CSP review'].result).toBe('FAIL');
		const d2 = baseData();
		d2.csp.pages[0].unsafeInline = ['script-src'];
		expect(summary(renderAudit(d2))['CSP review'].result).toBe('FAIL');
		const d3 = baseData();
		d3.csp.pages[0].metaFirst = false;
		expect(summary(renderAudit(d3))['CSP review'].result).toBe('FAIL');
		const b = baseData({ banned: { files: 120, hits: ['a.svelte:1: banned term "x"'] } });
		expect(summary(renderAudit(b))['Banned terms'].result).toBe('FAIL');
		const b0 = baseData({ banned: { files: 0, hits: [] } });
		expect(summary(renderAudit(b0))['Banned terms'].result).toBe('FAIL');
		const s = baseData();
		s.seo.targets[0].errors = ['sitemap.xml: missing'];
		expect(summary(renderAudit(s))['Sitemap/robots/OG'].result).toBe('FAIL');
		const e = pwReport([
			...axeSpecs(),
			...evidenceFixtures().e2e,
			{ file: 'disclaimers.spec.ts', title: 'disclaimer: footer', ok: false }
		]);
		const md = renderAudit(baseData({ e2eReport: e }));
		expect(summary(md)['Disclaimer presence'].result).toBe('FAIL');
		expect(md).toContain('| footer | not a real estate brokerage | FAIL |');
	});

	test('Human UAT lists every owner step with where to record the result', () => {
		const md = renderAudit(baseData());
		const section = md.slice(md.indexOf('## Human UAT (deferred)'), md.indexOf('## Sign-off'));
		HUMAN_UAT.forEach((s: { title: string }, i: number) =>
			expect(section).toContain(`${i + 1}. **${s.title}.**`)
		);
		const rec =
			/Record result in \.planning\/phases\/10-launch-hardening-go-to-market\/10-HUMAN-UAT\.md/g;
		expect(section.match(rec)).toHaveLength(HUMAN_UAT.length);
	});
});

describe('a11yMatrix', () => {
	test('route x keyless/keyed x root/sub with PASS/FAIL and violation text', () => {
		const error = 'axe violations on "":\nregion (moderate): x\nlabel (critical): y';
		const m = a11yMatrix(pwReport(axeSpecs({ route: '', project: 'root', error })));
		expect(m.rows.map((r: { route: string }) => r.route)).toEqual(['', 'tools/']);
		const landing = m.rows[0];
		expect(landing.cells['keyless/root'].status).toBe('PASS');
		expect(landing.cells['keyed/root'].status).toBe('FAIL');
		expect(landing.cells['keyed/root'].violations).toEqual([
			'region (moderate): x',
			'label (critical): y'
		]);
		expect(m.rows[1].cells['keyed/sub'].status).toBe('PASS');
		expect(m.keyless).toBe('PASS');
		expect(m.keyed).toBe('FAIL');
	});

	test('a missing cell is FAIL (not run), and no axe results at all is FAIL', () => {
		const specs = axeSpecs().filter(
			(s) => !(s.title === AXE_KEYED('tools/') && s.project === 'sub')
		);
		const m = a11yMatrix(pwReport(specs));
		expect(m.rows[1].cells['keyed/sub'].status).toBe('FAIL');
		expect(m.keyed).toBe('FAIL');
		expect(a11yMatrix(pwReport([])).keyless).toBe('FAIL');
		expect(a11yMatrix(null).keyless).toBe('FAIL');
	});
});
