// Static read-only guard over the smoke suite (SMOKE-01, SMOKE-05). The runtime monitor in
// apps/web/tests/smoke/fixtures.ts catches a write when it happens; this guard rejects the source
// that could cause one before the suite ever runs against a live origin. Pure rules over file text,
// one planted case per rule, and a pass on the real apps/web/tests/smoke tree.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const REPO = join(import.meta.dirname, '..');
const SMOKE_DIR = 'apps/web/tests/smoke';

interface SmokeFile {
	path: string;
	text: string;
}

/** Calls that type into, click, toggle or upload: a read-only smoke never interacts with a form. */
const INTERACTIONS: readonly [string, RegExp][] = [
	['fill', /\.fill\(/],
	['type', /\.type\(/],
	['press', /\.press\(/],
	['check', /\.check\(/],
	['selectOption', /\.selectOption\(/],
	['setInputFiles', /\.setInputFiles\(/],
	['click', /\.click\(/],
	['dblclick', /\.dblclick\(/],
	['tap', /\.tap\(/]
];
/** Writes through the API request context or a hand-built request. */
const WRITES: readonly [string, RegExp][] = [
	['request.post', /\brequest\.post\(/],
	['request.put', /\brequest\.put\(/],
	['request.delete', /\brequest\.delete\(/],
	['request.patch', /\brequest\.patch\(/],
	['method POST', /method:\s*['"`]POST['"`]/i]
];
/** E2E helpers that seed storage, plant keys or mock RentCast: none belongs in a smoke. */
const BANNED_IMPORTS: readonly [string, RegExp][] = [
	['seed', /seed/i],
	['fake-keys', /fake-keys/],
	['rentcast-mocks', /rentcast-mocks/],
	['support/network', /support\/network/]
];
const IMPORT_SPEC = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;

const base = (p: string) => p.split('/').pop() ?? p;
const isSpec = (p: string) => p.endsWith('.smoke.ts');
const isFixtures = (p: string) => base(p) === 'fixtures.ts';
const isAnalytics = (p: string) => base(p) === 'analytics.smoke.ts';

/** Every rule violation in a set of smoke files, as `<path>: <rule>`. Pure. */
export function readOnlyViolations(files: readonly SmokeFile[]): string[] {
	const out: string[] = [];
	const gpcOffUsers: string[] = [];
	for (const { path, text } of files) {
		for (const [name, re] of INTERACTIONS) {
			if (re.test(text)) out.push(`${path}: interaction .${name}(`);
		}
		for (const [name, re] of WRITES) if (re.test(text)) out.push(`${path}: write ${name}`);
		const specs = [...text.matchAll(IMPORT_SPEC)].map((m) => m[1]);
		for (const spec of specs) {
			for (const [name, re] of BANNED_IMPORTS) {
				if (re.test(spec)) out.push(`${path}: banned import ${name} (${spec})`);
			}
		}
		if (isSpec(path)) {
			if (specs.includes('@playwright/test')) {
				out.push(`${path}: imports @playwright/test directly`);
			}
			if (!specs.includes('./fixtures')) out.push(`${path}: does not import from ./fixtures`);
		}
		if (/\btestGpcOff\b/.test(text) && !isFixtures(path)) {
			gpcOffUsers.push(path);
			if (!isAnalytics(path)) out.push(`${path}: testGpcOff outside analytics.smoke.ts`);
		}
		if (/\bbeaconBudget\b/.test(text) && !isFixtures(path) && !isAnalytics(path)) {
			out.push(`${path}: beaconBudget outside fixtures.ts and analytics.smoke.ts`);
		}
	}
	if (files.some((f) => isSpec(f.path)) && gpcOffUsers.length !== 1) {
		out.push(`testGpcOff must have exactly one importer (found ${gpcOffUsers.length})`);
	}
	return out;
}

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const abs = join(dir, e.name);
		if (e.isDirectory()) return walk(abs);
		return /\.(ts|js)$/.test(e.name) ? [abs] : [];
	});
}

const realFiles = (): SmokeFile[] =>
	walk(join(REPO, SMOKE_DIR)).map((abs) => ({
		path: relative(REPO, abs).replaceAll('\\', '/'),
		text: readFileSync(abs, 'utf8')
	}));

/** A minimal clean suite: fixtures, one ordinary spec and the analytics spec. Planted cases extend it. */
const FIXTURES = `import { test as base } from '@playwright/test';\nexport const testGpcOff = base; // beaconBudget option\n`;
const CLEAN_SPEC = `import { test, expect } from './fixtures';\ntest('x', async ({ page }) => { await page.goto(''); });\n`;
const ANALYTICS = `import { testGpcOff as test, expect, smoke } from './fixtures';\ntest.use({ beaconBudget: 1 });\n`;
const suite = (extra: SmokeFile[] = []): SmokeFile[] => [
	{ path: `${SMOKE_DIR}/fixtures.ts`, text: FIXTURES },
	{ path: `${SMOKE_DIR}/routing.smoke.ts`, text: CLEAN_SPEC },
	{ path: `${SMOKE_DIR}/analytics.smoke.ts`, text: ANALYTICS },
	...extra
];
const planted = (body: string, name = 'planted.smoke.ts'): SmokeFile => ({
	path: `${SMOKE_DIR}/${name}`,
	text: `import { test } from './fixtures';\n${body}\n`
});
const P = `${SMOKE_DIR}/planted.smoke.ts`;

describe('the real smoke suite', () => {
	test('passes every rule', () => {
		const files = realFiles();
		expect(files.filter((f) => isSpec(f.path)).length).toBe(10); // non-vacuity
		expect(readOnlyViolations(files)).toEqual([]);
	});
});

describe('readOnlyViolations', () => {
	test('a clean planted suite has no violations (negative control)', () => {
		expect(readOnlyViolations(suite())).toEqual([]);
	});

	test.each([
		['fill', `await page.getByLabel('Key').fill('x');`],
		['type', `await page.locator('input').type('x');`],
		['press', `await page.keyboard.press('Enter');`],
		['check', `await page.getByRole('checkbox').check();`],
		['selectOption', `await page.locator('select').selectOption('a');`],
		['setInputFiles', `await page.locator('input').setInputFiles('f.json');`],
		['click', `await page.getByRole('button').click();`],
		['dblclick', `await page.locator('p').dblclick();`],
		['tap', `await page.locator('p').tap();`]
	])('flags the interaction .%s(', (name, body) => {
		expect(readOnlyViolations(suite([planted(body)]))).toEqual([`${P}: interaction .${name}(`]);
	});

	test.each([
		['request.post', `await request.post('api/send', { data: {} });`],
		['request.put', `await request.put('x');`],
		['request.delete', `await request.delete('x');`],
		['request.patch', `await request.patch('x');`],
		['method POST', `await page.evaluate(() => fetch('x', { method: 'POST' }));`]
	])('flags the write %s', (name, body) => {
		expect(readOnlyViolations(suite([planted(body)]))).toEqual([`${P}: write ${name}`]);
	});

	test.each([
		['seed', '../e2e/support/seed'],
		['fake-keys', '../support/fake-keys'],
		['rentcast-mocks', '../e2e/support/rentcast-mocks'],
		['support/network', '../e2e/support/network']
	])('flags a banned %s import', (name, spec) => {
		expect(readOnlyViolations(suite([planted(`import { x } from '${spec}';`)]))).toEqual([
			`${P}: banned import ${name} (${spec})`
		]);
	});

	test('flags a dynamic import of a banned helper', () => {
		const v = readOnlyViolations(
			suite([planted(`const m = await import('../e2e/support/seed');`)])
		);
		expect(v).toEqual([`${P}: banned import seed (../e2e/support/seed)`]);
	});

	test('flags a spec importing @playwright/test directly', () => {
		const v = readOnlyViolations(suite([planted(`import { test as t } from '@playwright/test';`)]));
		expect(v).toEqual([`${P}: imports @playwright/test directly`]);
	});

	test('fixtures.ts may import @playwright/test and define testGpcOff', () => {
		expect(readOnlyViolations(suite()).filter((v) => v.includes('fixtures.ts'))).toEqual([]);
	});

	test('flags a spec that does not import from ./fixtures', () => {
		const v = readOnlyViolations(
			suite([{ path: `${SMOKE_DIR}/bare.smoke.ts`, text: `export const x = 1;\n` }])
		);
		expect(v).toEqual([`${SMOKE_DIR}/bare.smoke.ts: does not import from ./fixtures`]);
	});

	test('flags a second testGpcOff importer', () => {
		const v = readOnlyViolations(
			suite([planted(`import { testGpcOff } from './fixtures';`, 'second.smoke.ts')])
		);
		expect(v).toEqual([
			`${SMOKE_DIR}/second.smoke.ts: testGpcOff outside analytics.smoke.ts`,
			'testGpcOff must have exactly one importer (found 2)'
		]);
	});

	test('flags a suite where analytics.smoke.ts no longer uses testGpcOff', () => {
		const files = suite().map((f) =>
			isAnalytics(f.path) ? { ...f, text: `import { test } from './fixtures';\n` } : f
		);
		expect(readOnlyViolations(files)).toEqual([
			'testGpcOff must have exactly one importer (found 0)'
		]);
	});

	test('flags beaconBudget outside fixtures.ts and analytics.smoke.ts', () => {
		const v = readOnlyViolations(suite([planted(`test.use({ beaconBudget: 2 });`)]));
		expect(v).toEqual([`${P}: beaconBudget outside fixtures.ts and analytics.smoke.ts`]);
	});

	test('rules apply to helper files too, not only specs', () => {
		const v = readOnlyViolations(
			suite([{ path: `${SMOKE_DIR}/helpers/util.js`, text: `x.click();\n` }])
		);
		expect(v).toEqual([`${SMOKE_DIR}/helpers/util.js: interaction .click(`]);
	});
});
