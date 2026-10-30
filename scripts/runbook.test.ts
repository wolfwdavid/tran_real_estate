// Text oracle for docs/RUNBOOK.md (13-08, LIVE-09). The runbook is the owner's one document for
// operating the live site, so its section order is load-bearing and every number it quotes (smoke
// workers and budget, smoke.mjs exit codes, the live-smoke artifact and its retention, the
// Dependabot ignore list) is read back from the real file it describes. ci.yml is deliberately not
// read here: the deploy gate and the Pages artifact are pinned by scripts/workflow-gate.test.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const DOC = read('docs/RUNBOOK.md');
/** The doc with every whitespace run collapsed, for prose that Prettier may re-wrap. */
const FLAT = DOC.replace(/\s+/g, ' ');
const SMOKE_CONFIG = read('apps/web/playwright.smoke.config.ts');
const SMOKE_MJS = read('scripts/smoke.mjs');
const LIVE_SMOKE = read('.github/workflows/live-smoke.yml');
const DEPENDABOT = read('.github/dependabot.yml');

const HEADINGS = [
	'# Runbook: Tran Real Estate Tools on GitHub Pages',
	'## Variables',
	'## Redeploy',
	'## Roll back',
	'## Read a live-smoke result',
	'## Run the suites locally',
	'## Fresh-profile rule',
	'## Dependabot policy',
	'## Analytics: synthetic pageviews',
	'## Launch proof screenshots',
	'## First deploy facts'
];

/** The eight repository variables the workflows read (13-RESEARCH "Runbook facts"). */
const VARIABLES = [
	'PAGES_ENABLED',
	'PUBLIC_SITE_URL',
	'BASE_PATH',
	'PUBLIC_ANALYTICS_HOST',
	'PUBLIC_ANALYTICS_WEBSITE_ID',
	'PUBLIC_WEB3FORMS_KEY',
	'PUBLIC_CONTACT_EMAIL',
	'EXTENSION_RELEASES_ENABLED'
];

/** A `## ` section: its heading line up to (not including) the next `## ` heading. */
function section(title: string): string {
	const start = DOC.indexOf(`\n${title}\n`);
	if (start === -1) throw new Error(`no heading ${title}`);
	const next = DOC.indexOf('\n## ', start + 1);
	return DOC.slice(start + 1, next === -1 ? undefined : next);
}

/** Cells of every table row whose first cell is a code span, keyed by that span's text (Prettier pads cells). */
function tableRows(text: string): Map<string, string[]> {
	const rows = new Map<string, string[]>();
	for (const m of text.matchAll(/^\| `([^`]+)`\s*\|(.*)\|$/gm)) {
		rows.set(
			m[1],
			m[2].split('|').map((c) => c.trim())
		);
	}
	return rows;
}

/** `dependency-name` entries of the npm `ignore:` list in dependabot.yml. */
function dependabotIgnores(): string[] {
	const start = DEPENDABOT.indexOf('ignore:');
	const end = DEPENDABOT.indexOf('groups:', start);
	if (start === -1 || end === -1) throw new Error('dependabot.yml has no npm ignore list');
	return [...DEPENDABOT.slice(start, end).matchAll(/dependency-name: '([^']+)'/g)].map((m) => m[1]);
}

describe('structure', () => {
	test('the eleven headings appear in the locked order and nothing else is a heading', () => {
		const found = DOC.split('\n').filter((l) => /^#{1,2} /.test(l));
		expect(found).toEqual(HEADINGS);
	});

	test('names only the real origin', () => {
		expect(DOC).not.toMatch(/tranrealestate/);
		expect(DOC).toMatch(/https:\/\/wolfwdavid\.github\.io\/tran_real_estate\//);
	});
});

describe('Variables', () => {
	const rows = tableRows(section('## Variables'));

	test('one table row per variable, exactly the eight', () => {
		expect([...rows.keys()].sort()).toEqual([...VARIABLES].sort());
	});

	test('every row says which workflow or leg reads the variable', () => {
		for (const name of VARIABLES) {
			const cells = rows.get(name) ?? [];
			expect(cells, name).toHaveLength(2);
			expect(cells[1], name).toMatch(/\bci\b|live-smoke|extension-release|root leg/);
		}
	});

	test('PUBLIC_SITE_URL is the origin only and BASE_PATH is set with MSYS_NO_PATHCONV', () => {
		expect(rows.get('PUBLIC_SITE_URL')?.[0]).toBe('`https://wolfwdavid.github.io`');
		expect(rows.get('BASE_PATH')?.[0]).toBe('`/tran_real_estate`');
		expect(section('## Variables')).toMatch(/MSYS_NO_PATHCONV=1/);
	});
});

describe('Redeploy', () => {
	test('is an empty commit pushed to main; a dispatch of ci deploys nothing', () => {
		const s = section('## Redeploy');
		expect(s).toContain('git commit --allow-empty -m "chore: redeploy"');
		expect(s).toContain('git push');
		expect(s).toMatch(/workflow_dispatch/);
		expect(s).toMatch(/deploys nothing/);
	});
});

describe('Roll back', () => {
	const s = section('## Roll back');

	test('prefers git revert + push', () => {
		expect(s).toMatch(/git revert <bad-sha>/);
		expect(s.indexOf('git revert')).toBeLessThan(s.indexOf('Re-run all jobs'));
	});

	test('names the re-run alternative with its two windows', () => {
		expect(s).toContain('Re-run all jobs');
		expect(s).toContain('retention-days: 1');
		expect(s).toMatch(/30 days/);
		expect(s).toMatch(/1 day/);
		expect(s).toMatch(/original actor/);
	});
});

describe('Read a live-smoke result', () => {
	const s = section('## Read a live-smoke result');

	test('names the artifact and retention from live-smoke.yml and the trace viewer', () => {
		const upload = LIVE_SMOKE.slice(LIVE_SMOKE.indexOf('actions/upload-artifact'));
		const artifact = /name: (\S+)/.exec(upload)?.[1];
		const retention = /retention-days: (\d+)/.exec(upload)?.[1];
		expect(artifact).toBe('live-smoke-traces');
		expect(retention).toBeDefined();
		expect(s).toContain(`--name ${artifact}`);
		expect(s).toContain(`${retention} days`);
		expect(s).toContain('playwright show-trace');
	});

	test('has a table row for each exit code 0-4', () => {
		const codes = [...s.matchAll(/^\| ([0-9])\s*\|/gm)].map((m) => Number(m[1]));
		expect(codes).toEqual([0, 1, 2, 3, 4]);
	});

	test('exit-code wording matches the smoke.mjs header', () => {
		const header = SMOKE_MJS.slice(0, SMOKE_MJS.indexOf('import '));
		for (const phrase of ['precondition', 'not propagated', '5-minute budget']) {
			expect(header, phrase).toContain(phrase);
			expect(s, phrase).toContain(phrase);
		}
		expect(s).toMatch(/10 minutes/);
	});

	test('explains a skipped run and the hand dispatch', () => {
		expect(FLAT).toMatch(/skipped run means Pages is off/);
		expect(s).toContain(
			'gh workflow run live-smoke.yml --repo wolfwdavid/tran_real_estate -f base_url=https://wolfwdavid.github.io/tran_real_estate/'
		);
		expect(s).toContain('--workflow live-smoke.yml');
		expect(s).toContain('--log-failed');
	});

	test('the CDN note measures propagation and never raises the poll', () => {
		expect(s).toContain('smoke: <sha> live at <url> after <n> s');
		expect(FLAT).toMatch(/Never raise the poll/);
	});
});

describe('Run the suites locally', () => {
	const s = section('## Run the suites locally');

	test('web E2E worker counts: dev machine 4, CI 2', () => {
		expect(s).toContain('--workers=4');
		expect(s).toMatch(/2 workers/);
		expect(s).toContain('pnpm --filter web exec playwright test --project=root --workers=4');
	});

	test('the smoke worker line and budget are the ones in playwright.smoke.config.ts', () => {
		const workers = /workers: process\.env\.CI \? \d+ : \d+/.exec(SMOKE_CONFIG)?.[0];
		const budget = /globalTimeout: (\d+)_000/.exec(SMOKE_CONFIG)?.[1];
		expect(workers).toBeDefined();
		expect(budget).toBeDefined();
		expect(s).toContain(workers);
		expect(s).toContain(`${budget} s`);
	});

	test('names the four local commands', () => {
		for (const cmd of ['pnpm test:unit', 'pnpm smoke:local', 'pnpm verify']) {
			expect(s).toContain(cmd);
		}
		expect(s).toContain('MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate');
	});
});

describe('Fresh-profile rule', () => {
	test('new private window after every redeploy, with the two reasons', () => {
		const s = section('## Fresh-profile rule');
		expect(s).toMatch(/InPrivate/);
		expect(s).toMatch(/Incognito/);
		expect(s).toMatch(/after every redeploy/);
		expect(s).toContain('max-age=600');
		expect(s).toMatch(/cache-first/);
	});
});

describe('Dependabot policy', () => {
	const s = section('## Dependabot policy');
	const ignores = dependabotIgnores();

	test('names every major-ignored dependency from dependabot.yml', () => {
		expect(ignores.length).toBeGreaterThanOrEqual(6); // non-vacuity
		for (const name of ignores) expect(s, name).toContain(`\`${name}\``);
		expect(s).toMatch(/Phase 16/);
	});

	test('@types/node follows owner decision B', () => {
		if (ignores.includes('@types/node')) {
			expect(s).toMatch(/decision B/);
		} else {
			expect(s).toMatch(/closed by hand/);
		}
	});

	test('minor/patch PRs go through the audit gate and actions PRs need green CI', () => {
		expect(s).toContain('pnpm audit');
		expect(s).toMatch(/never merged blind/);
		expect(s).toMatch(/github-actions/);
		expect(s).toMatch(/green/);
	});
});

describe('Analytics: synthetic pageviews', () => {
	test('one GPC-off spec, at most one pageview, counts are a lower bound', () => {
		const s = section('## Analytics: synthetic pageviews');
		expect(s).toContain('at most one');
		expect(s).toMatch(/lower bound/);
	});
});

describe('Launch proof screenshots', () => {
	test('the proof-shot script sends GPC, writes checks.json, and the bundle stays small', () => {
		const s = section('## Launch proof screenshots');
		expect(s).toContain('tests/smoke/proof-shots.mjs');
		expect(s).toContain('--base-url https://wolfwdavid.github.io/tran_real_estate/');
		expect(s).toContain('Sec-GPC: 1');
		expect(s).toContain('checks.json');
		expect(s).toMatch(/redact/i);
		expect(s).toContain('5 MB');
	});
});

describe('First deploy facts', () => {
	test('is the go-live placeholder or a measured list with a propagation line', () => {
		const body = section('## First deploy facts').split('\n').slice(1).join('\n').trim();
		expect(body.length).toBeGreaterThan(0);
		const placeholder = body === 'Recorded at go-live (plan 13-19).';
		const measured = /after \d+ s/.test(body);
		expect(placeholder || measured, body).toBe(true);
	});
});
