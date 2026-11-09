// Phase 15 test-lane rules (TEST-01/TEST-02): planted violations and negative controls. The repo
// sweep is scripts/test-lanes.test.ts.
//
// Every planted source lives inside a template literal, so the repo sweep (which parses real calls)
// never sees these as real raises, retries or timing assertions.
import { describe, expect, test } from 'vitest';
import {
	CAUSE,
	DEFAULTS,
	MEASURED,
	PINNED_RETRIES,
	TO_PASS_ALLOWLIST,
	configTimeoutFindings,
	elapsedTimeFindings,
	fileKind,
	laneOf,
	playwrightTimeoutFindings,
	retryFindings,
	scanFile,
	toPassFindings,
	vitestTimeoutFindings
} from './lib/test-lane-rules.mjs';

type Finding = { path: string; line: number; rule: string; detail: string };
type Lane = { project: string; serial: boolean; browser: boolean };

/** `[rule, line]` pairs, the shape every assertion below compares against. */
const rl = (findings: Finding[]) => findings.map((f) => [f.rule, f.line]);

const SERIAL = {
	core: [{ file: 'src/a.test.ts' }],
	web: [{ file: 'src/lib/b.test.ts' }],
	'web-browser': [{ file: 'src/lib/C.browser.test.ts' }],
	scripts: [{ file: 'x.test.ts' }]
};

const NODE: Lane = { project: 'core', serial: false, browser: false };
const BROWSER: Lane = { project: 'web-browser', serial: false, browser: true };
const SERIAL_NODE: Lane = { project: 'web', serial: true, browser: false };

const VT = 'packages/core/src/z.test.ts';
const PW = 'apps/web/tests/e2e/x.spec.ts';
const VCFG = 'scripts/vitest.config.ts';
const VCFG_BROWSER = 'apps/web/vitest.browser.config.ts';
const PCFG = 'apps/web/playwright.config.ts';
const SMOKE_CFG = 'apps/web/playwright.smoke.config.ts';

const NOTE = '// Timeout: measured 13.5 s in a full run.\n// Cause: cold ESLint parser.\n';
const NOTE_NO_NUMBER = '// Timeout: measured in a full run.\n// Cause: cold ESLint parser.\n';
const NOTE_NO_CAUSE = '// Timeout: measured 13.5 s in a full run.\n// Because of a cold parser.\n';

describe('constants', () => {
	test('DEFAULTS carries the resolved Vitest and Playwright defaults and is frozen', () => {
		expect(DEFAULTS).toEqual({
			nodeTest: 5000,
			browserTest: 15000,
			nodeHook: 10000,
			browserHook: 30000,
			wait: 1000,
			pwTest: 30000,
			pwExpect: 5000
		});
		expect(Object.isFrozen(DEFAULTS)).toBe(true);
	});

	test('MEASURED needs the word plus a number and a unit; CAUSE needs the word', () => {
		expect(MEASURED.test('Timeout: measured 13.5 s in a full run.')).toBe(true);
		expect(MEASURED.test('measured 240 ms')).toBe(true);
		expect(MEASURED.test('measured 2 min')).toBe(true);
		expect(MEASURED.test('measured in a full run')).toBe(false);
		expect(MEASURED.test('13.5 s in a full run')).toBe(false);
		expect(CAUSE.test('Cause: cold parser')).toBe(true);
		expect(CAUSE.test('because of a cold parser')).toBe(false);
	});

	test('TO_PASS_ALLOWLIST and PINNED_RETRIES pin the two sites and three configs, frozen', () => {
		expect(TO_PASS_ALLOWLIST).toEqual({
			'apps/web/tests/e2e/investor/buybox.spec.ts': 1,
			'apps/web/tests/e2e/investor/demo.spec.ts': 1
		});
		expect(PINNED_RETRIES).toEqual({
			'apps/web/playwright.config.ts': 'process.env.CI ? 1 : 0',
			'apps/extension/playwright.config.ts': 'process.env.CI ? 1 : 0',
			'apps/web/playwright.smoke.config.ts': '0'
		});
		expect(Object.isFrozen(TO_PASS_ALLOWLIST)).toBe(true);
		expect(Object.isFrozen(PINNED_RETRIES)).toBe(true);
	});
});

describe('laneOf', () => {
	test('a core file listed in the manifest is serial', () => {
		expect(laneOf('packages/core/src/a.test.ts', SERIAL)).toEqual({
			project: 'core',
			serial: true,
			browser: false
		});
	});

	test('a core file not listed is parallel', () => {
		expect(laneOf('packages/core/src/z.test.ts', SERIAL)).toEqual({
			project: 'core',
			serial: false,
			browser: false
		});
	});

	test('brand resolves to its own project', () => {
		expect(laneOf('packages/brand/src/q.test.ts', SERIAL)).toEqual({
			project: 'brand',
			serial: false,
			browser: false
		});
	});

	test('a listed .browser.test.ts under apps/web is web-browser serial', () => {
		expect(laneOf('apps/web/src/lib/C.browser.test.ts', SERIAL)).toEqual({
			project: 'web-browser',
			serial: true,
			browser: true
		});
	});

	test('an unlisted .browser.test.ts under apps/web is web-browser parallel', () => {
		expect(laneOf('apps/web/src/lib/D.browser.test.ts', SERIAL)).toEqual({
			project: 'web-browser',
			serial: false,
			browser: true
		});
	});

	test('apps/web node tests resolve to web, serial only when listed', () => {
		expect(laneOf('apps/web/src/lib/b.test.ts', SERIAL)).toEqual({
			project: 'web',
			serial: true,
			browser: false
		});
		expect(laneOf('apps/web/src/lib/e.spec.ts', SERIAL)).toEqual({
			project: 'web',
			serial: false,
			browser: false
		});
	});

	test('scripts tests resolve to scripts, serial only when listed', () => {
		expect(laneOf('scripts/x.test.ts', SERIAL)).toEqual({
			project: 'scripts',
			serial: true,
			browser: false
		});
		expect(laneOf('scripts/lib/y.test.ts', SERIAL)).toEqual({
			project: 'scripts',
			serial: false,
			browser: false
		});
	});

	test('extension tests split into extension-browser and extension', () => {
		expect(laneOf('apps/extension/tests/browser/P.browser.test.ts', SERIAL)).toEqual({
			project: 'extension-browser',
			serial: false,
			browser: true
		});
		expect(laneOf('apps/extension/tests/u.test.ts', SERIAL)).toEqual({
			project: 'extension',
			serial: false,
			browser: false
		});
	});

	test('Playwright specs, docs and node_modules have no Vitest lane', () => {
		expect(laneOf('apps/web/tests/e2e/a.spec.ts', SERIAL)).toBeNull();
		expect(laneOf('README.md', SERIAL)).toBeNull();
		expect(laneOf('apps/web/node_modules/x/a.test.ts', SERIAL)).toBeNull();
	});
});

describe('fileKind', () => {
	test('Playwright specs, support, smoke fixtures and extension e2e are playwright', () => {
		expect(fileKind('apps/web/tests/e2e/x.spec.ts')).toBe('playwright');
		expect(fileKind('apps/web/tests/support/h.ts')).toBe('playwright');
		expect(fileKind('apps/web/tests/smoke/fixtures.ts')).toBe('playwright');
		expect(fileKind('apps/extension/e2e/extension.spec.ts')).toBe('playwright');
	});

	test('vite and vitest configs (any infix) are vitest-config', () => {
		expect(fileKind('vitest.config.ts')).toBe('vitest-config');
		expect(fileKind('scripts/vitest.serial.config.ts')).toBe('vitest-config');
		expect(fileKind('apps/web/vite.config.ts')).toBe('vitest-config');
		expect(fileKind('apps/web/vitest.browser.serial.config.ts')).toBe('vitest-config');
	});

	test('playwright configs are playwright-config', () => {
		expect(fileKind('apps/web/playwright.config.ts')).toBe('playwright-config');
		expect(fileKind('apps/web/playwright.smoke.config.ts')).toBe('playwright-config');
	});

	test('package.json, workflows and scripts/*.mjs have their own kinds', () => {
		expect(fileKind('package.json')).toBe('package-json');
		expect(fileKind('apps/web/package.json')).toBe('package-json');
		expect(fileKind('.github/workflows/ci.yml')).toBe('workflow');
		expect(fileKind('scripts/smoke.mjs')).toBe('script-mjs');
		expect(fileKind('scripts/lib/x.mjs')).toBe('script-mjs');
	});

	test('a path laneOf maps is vitest-test, everything else is null', () => {
		expect(fileKind('packages/core/src/z.test.ts')).toBe('vitest-test');
		expect(fileKind('apps/web/src/lib/D.browser.test.ts')).toBe('vitest-test');
		expect(fileKind('README.md')).toBeNull();
		expect(fileKind('apps/web/node_modules/x/a.test.ts')).toBeNull();
	});
});

describe('elapsedTimeFindings', () => {
	test('flags performance.now()', () => {
		expect(rl(elapsedTimeFindings(VT, `const t = performance.now();`))).toEqual([
			['elapsed-time', 1]
		]);
	});

	test('flags process.hrtime()', () => {
		expect(rl(elapsedTimeFindings(VT, `const t = process.hrtime();`))).toEqual([
			['elapsed-time', 1]
		]);
	});

	test('flags process.hrtime.bigint()', () => {
		expect(rl(elapsedTimeFindings(VT, `const t = process.hrtime.bigint();`))).toEqual([
			['elapsed-time', 1]
		]);
	});

	test('flags Date.now() on the left of a subtraction', () => {
		const src = `expect(Date.now() - started).toBeLessThan(10);`;
		expect(rl(elapsedTimeFindings(VT, src))).toEqual([['elapsed-time', 1]]);
	});

	test('flags Date.now() on the right of a subtraction', () => {
		expect(rl(elapsedTimeFindings(VT, `const d = started - Date.now();`))).toEqual([
			['elapsed-time', 1]
		]);
	});

	test('reports the 1-based line of the call', () => {
		const src = `const a = 1;\nconst b = 2;\nconst t = performance.now();`;
		expect(rl(elapsedTimeFindings(VT, src))).toEqual([['elapsed-time', 3]]);
	});

	test('does not flag Date.now() used as a value', () => {
		expect(elapsedTimeFindings(VT, `const NOW = Date.now();`)).toEqual([]);
	});

	test('does not flag Date.now() in an addition', () => {
		expect(elapsedTimeFindings(VT, `const d = new Date(Date.now() + 1000);`)).toEqual([]);
	});

	test('does not flag Date.now() passed to vi.setSystemTime', () => {
		expect(elapsedTimeFindings(VT, `vi.setSystemTime(Date.now());`)).toEqual([]);
	});

	test('does not flag performance.now inside a string', () => {
		expect(elapsedTimeFindings(VT, `const s = 'performance.now()';`)).toEqual([]);
	});

	test('does not flag performance.now inside a comment', () => {
		expect(elapsedTimeFindings(VT, `// performance.now()\nconst s = 1;`)).toEqual([]);
	});
});

describe('vitestTimeoutFindings in a parallel node lane', () => {
	const OUT = 'raised-timeout-outside-serial';

	test('flags a test options timeout above 5000', () => {
		const f = vitestTimeoutFindings(VT, `test('a', { timeout: 30_000 }, () => {});`, NODE);
		expect(rl(f)).toEqual([[OUT, 1]]);
		expect(f[0].detail).toContain('30000');
		expect(f[0].detail).toContain('5000');
	});

	test('flags a trailing numeric argument after an it.each callback', () => {
		const src = `it.each([1])('a', () => {}, 30_000);`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('flags a describe options timeout above 5000', () => {
		const src = `describe('d', { timeout: 6000 }, () => {});`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('flags a trailing argument on test.concurrent', () => {
		const src = `test.concurrent('a', async () => {}, 9000);`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('flags a hook trailing argument above 10000', () => {
		const src = `beforeAll(async () => {}, 20_000);`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('flags vi.waitFor options timeout above 1000', () => {
		const src = `await vi.waitFor(() => x(), { timeout: 2000 });`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('flags vi.waitFor numeric second argument above 1000', () => {
		const src = `await vi.waitFor(() => x(), 2000);`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('flags vi.waitUntil options timeout above 1000', () => {
		const src = `await vi.waitUntil(() => x(), { timeout: 1500 });`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('flags expect.poll options timeout above 1000', () => {
		const src = `await expect.poll(() => x(), { timeout: 2000 }).toBe(1);`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('flags expect.element options timeout above 1000', () => {
		const src = `await expect.element(el, { timeout: 4000 }).toBeVisible();`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('treats an identifier value as raised', () => {
		const src = `const MS = 10_000;\ntest('a', { timeout: MS }, () => {});`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 2]]);
	});

	test('treats an arithmetic value as raised', () => {
		const src = `test('a', { timeout: ROUTES.length * 4_000 }, () => {});`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('always flags vi.setConfig', () => {
		const src = `vi.setConfig({ testTimeout: 1 });`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('does not flag a lowered test timeout', () => {
		const src = `test('a', { timeout: 2_000 }, () => {});`;
		expect(vitestTimeoutFindings(VT, src, NODE)).toEqual([]);
	});

	test('does not flag a trailing argument equal to the default', () => {
		expect(vitestTimeoutFindings(VT, `test('a', () => {}, 5000);`, NODE)).toEqual([]);
	});

	test('does not flag expect.poll at its default', () => {
		const src = `await expect.poll(f, { timeout: 1000 });`;
		expect(vitestTimeoutFindings(VT, src, NODE)).toEqual([]);
	});

	test('does not flag a timeout option on a non-test API', () => {
		const src = `spawnSync('git', [], { timeout: 30_000 });`;
		expect(vitestTimeoutFindings(VT, src, NODE)).toEqual([]);
	});

	test('does not flag setTimeout', () => {
		expect(vitestTimeoutFindings(VT, `setTimeout(r, 30_000);`, NODE)).toEqual([]);
	});

	test('does not flag a local variable named it used as an iterator', () => {
		const src = `const r = await it.next().then(() => undefined, (e: unknown) => e);`;
		expect(vitestTimeoutFindings(VT, src, NODE)).toEqual([]);
	});

	test('still flags a trailing timeout through a skipIf modifier chain', () => {
		const src = `test.skipIf(cond)('a', () => {}, 30_000);`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});
});

describe('vitestTimeoutFindings on Prettier-wrapped wait chains', () => {
	// Prettier breaks a long `await expect.poll(...)` into `await expect\n\t.poll(...)`. The callee
	// is still the same property chain, so the raise must be reported at the chain's first line.
	const OUT = 'raised-timeout-outside-serial';

	test('flags expect.poll whose chain is wrapped onto the next line', () => {
		const src = `await expect\n\t.poll(() => container.querySelector('.leaflet-container'), { timeout: 2000 })\n\t.not.toBeNull();`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('flags expect.element whose chain is wrapped onto the next line', () => {
		const src = `await expect\n\t.element(page.getByRole('button', { name: 'Try again' }), { timeout: 4000 })\n\t.toBeEnabled();`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('flags vi.waitFor whose chain is wrapped onto the next line', () => {
		const src = `await vi\n\t.waitFor(() => expect(messages.length).toBeGreaterThan(0), { timeout: 20_000 });`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('a wrapped expect.poll with an identifier value is raised too', () => {
		const src = `const LAZY_MAP_MS = 10_000;\nawait expect\n\t.poll(() => x(), { timeout: LAZY_MAP_MS })\n\t.toBe(1);`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 2]]);
	});

	test('a wrapped expect.poll at the default is not flagged', () => {
		const src = `await expect\n\t.poll(() => x(), { timeout: 1000 })\n\t.toBe(1);`;
		expect(vitestTimeoutFindings(VT, src, NODE)).toEqual([]);
	});

	test('a wrapped vi.setConfig is still always flagged', () => {
		const src = `vi\n\t.setConfig({ testTimeout: 1 });`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('in the serial lane a wrapped raise still needs the annotation above the statement', () => {
		const SP = 'apps/web/src/lib/b.test.ts';
		const raise = `await expect\n\t.poll(() => x(), { timeout: 2000 })\n\t.toBe(1);`;
		expect(rl(vitestTimeoutFindings(SP, raise, SERIAL_NODE))).toEqual([['unannotated-raise', 1]]);
		expect(vitestTimeoutFindings(SP, NOTE + raise, SERIAL_NODE)).toEqual([]);
	});
});

describe('playwright rules on Prettier-wrapped chains', () => {
	test('flags a wrapped describe.configure timeout above 30 s', () => {
		const src = `test.describe\n\t.configure({ mode: 'serial', timeout: 300_000 });`;
		expect(rl(playwrightTimeoutFindings(PW, src))).toEqual([['unannotated-raise', 1]]);
	});

	test('flags a wrapped describe.configure retries', () => {
		const src = `test.describe\n\t.configure({ retries: 2 });`;
		expect(rl(retryFindings(PW, src))).toEqual([['retry', 1]]);
	});

	test('flags a wrapped test.setTimeout above 30 s', () => {
		expect(rl(playwrightTimeoutFindings(PW, `test\n\t.setTimeout(240_000);`))).toEqual([
			['unannotated-raise', 1]
		]);
	});
});

describe('vitestTimeoutFindings in a parallel browser lane', () => {
	test('does not flag a test timeout at the 15 s browser default', () => {
		const src = `test('a', { timeout: 15_000 }, () => {});`;
		expect(vitestTimeoutFindings('apps/web/src/lib/D.browser.test.ts', src, BROWSER)).toEqual([]);
	});

	test('flags a test timeout above the browser default', () => {
		const src = `test('a', { timeout: 20_000 }, () => {});`;
		expect(rl(vitestTimeoutFindings('apps/web/src/lib/D.browser.test.ts', src, BROWSER))).toEqual([
			['raised-timeout-outside-serial', 1]
		]);
	});

	test('does not flag a hook at the 30 s browser hook default', () => {
		const src = `beforeAll(fn, 30_000);`;
		expect(vitestTimeoutFindings('apps/web/src/lib/D.browser.test.ts', src, BROWSER)).toEqual([]);
	});
});

describe('vitestTimeoutFindings in a serial lane', () => {
	const SP = 'apps/web/src/lib/b.test.ts';
	const RAISE = `test('a', { timeout: 30_000 }, () => {});`;

	test('a raise without a comment is an unannotated raise', () => {
		const f = vitestTimeoutFindings(SP, RAISE, SERIAL_NODE);
		expect(rl(f)).toEqual([['unannotated-raise', 1]]);
	});

	test('a raise with a measured + cause comment directly above the statement is fine', () => {
		expect(vitestTimeoutFindings(SP, NOTE + RAISE, SERIAL_NODE)).toEqual([]);
	});

	test('the comment may sit above the const declaration used as the value', () => {
		const src = `${NOTE}const MS = 20_000;\n\ntest('a', { timeout: MS }, () => {});`;
		expect(vitestTimeoutFindings(SP, src, SERIAL_NODE)).toEqual([]);
	});

	test('a comment with measured but no number does not count', () => {
		expect(rl(vitestTimeoutFindings(SP, NOTE_NO_NUMBER + RAISE, SERIAL_NODE))).toEqual([
			['unannotated-raise', 3]
		]);
	});

	test('a comment with a number but no cause does not count', () => {
		expect(rl(vitestTimeoutFindings(SP, NOTE_NO_CAUSE + RAISE, SERIAL_NODE))).toEqual([
			['unannotated-raise', 3]
		]);
	});

	test('the comment may sit above the option property inside a multi-line options object', () => {
		const src = [
			`test(`,
			`\t'a',`,
			`\t{`,
			`\t\t// Timeout: measured 13.5 s in a full run.`,
			`\t\t// Cause: cold ESLint parser.`,
			`\t\ttimeout: 20_000`,
			`\t},`,
			`\t() => {}`,
			`);`
		].join('\n');
		expect(vitestTimeoutFindings(SP, src, SERIAL_NODE)).toEqual([]);
	});

	test('a hook raise and a vi.setConfig in the serial lane still need the comment', () => {
		const src = `beforeAll(async () => {}, 20_000);\nvi.setConfig({ testTimeout: 1 });`;
		expect(rl(vitestTimeoutFindings(SP, src, SERIAL_NODE))).toEqual([
			['unannotated-raise', 1],
			['unannotated-raise', 2]
		]);
	});
});

describe('playwrightTimeoutFindings', () => {
	const UN = 'unannotated-raise';

	test('flags test.setTimeout above 30 s', () => {
		expect(rl(playwrightTimeoutFindings(PW, `test.setTimeout(240_000);`))).toEqual([[UN, 1]]);
	});

	test('does not flag test.setTimeout at 30 s', () => {
		expect(playwrightTimeoutFindings(PW, `test.setTimeout(30_000);`)).toEqual([]);
	});

	test('flags test.setTimeout(IDENT) when the const is unannotated', () => {
		const src = `const AI_MS = 240_000;\ntest.setTimeout(AI_MS);`;
		expect(rl(playwrightTimeoutFindings(PW, src))).toEqual([[UN, 2]]);
	});

	test('accepts test.setTimeout(IDENT) when the const is annotated', () => {
		const src = `${NOTE}const AI_MS = 240_000;\ntest.setTimeout(AI_MS);`;
		expect(playwrightTimeoutFindings(PW, src)).toEqual([]);
	});

	test('flags describe.configure timeout above 30 s', () => {
		const src = `test.describe.configure({ mode: 'serial', timeout: 300_000 });`;
		expect(rl(playwrightTimeoutFindings(PW, src))).toEqual([[UN, 1]]);
	});

	test('does not flag describe.configure without a timeout', () => {
		const src = `test.describe.configure({ mode: 'serial' });`;
		expect(playwrightTimeoutFindings(PW, src)).toEqual([]);
	});

	test('flags bare test.slow()', () => {
		const f = playwrightTimeoutFindings(PW, `test.slow();`);
		expect(rl(f)).toEqual([[UN, 1]]);
		expect(f[0].detail).toContain('test.slow()');
	});

	test('flags conditional test.slow(cond, reason)', () => {
		expect(rl(playwrightTimeoutFindings(PW, `test.slow(isMobile, 'reason');`))).toEqual([[UN, 1]]);
	});

	test('accepts an annotated test.slow()', () => {
		expect(playwrightTimeoutFindings(PW, `${NOTE}test.slow();`)).toEqual([]);
	});

	test('flags an expect option timeout above 5 s', () => {
		const src = `await expect(loc).toBeVisible({ timeout: 15_000 });`;
		expect(rl(playwrightTimeoutFindings(PW, src))).toEqual([[UN, 1]]);
	});

	test('does not flag an expect option timeout at 5 s', () => {
		const src = `await expect(loc).toBeVisible({ timeout: 5_000 });`;
		expect(playwrightTimeoutFindings(PW, src)).toEqual([]);
	});

	test('flags page.waitForURL with a raised timeout', () => {
		const src = `await page.waitForURL(u, { timeout: 60_000 });`;
		expect(rl(playwrightTimeoutFindings(PW, src))).toEqual([[UN, 1]]);
	});

	test('flags context.waitForEvent with a raised timeout', () => {
		const src = `await ctx.waitForEvent('serviceworker', { timeout: 15_000 });`;
		expect(rl(playwrightTimeoutFindings(PW, src))).toEqual([[UN, 1]]);
	});

	test('flags expect.configure with a raised timeout', () => {
		const src = `expect.configure({ timeout: 10_000 });`;
		expect(rl(playwrightTimeoutFindings(PW, src))).toEqual([[UN, 1]]);
	});

	test('does not flag page.waitForTimeout', () => {
		expect(playwrightTimeoutFindings(PW, `await page.waitForTimeout(500);`)).toEqual([]);
	});

	test('does not flag setTimeout', () => {
		expect(playwrightTimeoutFindings(PW, `setTimeout(r, 60_000);`)).toEqual([]);
	});
});

describe('configTimeoutFindings for Vitest configs', () => {
	const UN = 'unannotated-raise';
	const cfg = (body: string) => `export default defineConfig({\n\ttest: {\n${body}\n\t}\n});`;

	test('flags an unannotated testTimeout above 5000', () => {
		expect(rl(configTimeoutFindings(VCFG, cfg(`\t\ttestTimeout: 60_000`)))).toEqual([[UN, 3]]);
	});

	test('accepts an annotated testTimeout', () => {
		const body = `\t\t// Timeout: measured 13.5 s in a full run.\n\t\t// Cause: cold ESLint parser.\n\t\ttestTimeout: 60_000`;
		expect(configTimeoutFindings(VCFG, cfg(body))).toEqual([]);
	});

	test('does not flag testTimeout at the default', () => {
		expect(configTimeoutFindings(VCFG, cfg(`\t\ttestTimeout: 5000`))).toEqual([]);
	});

	test('flags hookTimeout above 10000 in a node config', () => {
		expect(rl(configTimeoutFindings(VCFG, cfg(`\t\thookTimeout: 20_000`)))).toEqual([[UN, 3]]);
	});

	test('does not flag testTimeout 15000 in a browser config', () => {
		expect(configTimeoutFindings(VCFG_BROWSER, cfg(`\t\ttestTimeout: 15_000`))).toEqual([]);
	});

	test('flags testTimeout above 15000 in a browser config', () => {
		expect(rl(configTimeoutFindings(VCFG_BROWSER, cfg(`\t\ttestTimeout: 20_000`)))).toEqual([
			[UN, 3]
		]);
	});
});

describe('configTimeoutFindings for Playwright configs', () => {
	const UN = 'unannotated-raise';

	test('flags an unannotated defineConfig timeout above 30 s', () => {
		const src = `export default defineConfig({ timeout: 60_000 });`;
		expect(rl(configTimeoutFindings(PCFG, src))).toEqual([[UN, 1]]);
	});

	test('accepts an annotated defineConfig timeout', () => {
		const src = `export default defineConfig({\n${NOTE}\ttimeout: 60_000\n});`;
		expect(configTimeoutFindings(PCFG, src)).toEqual([]);
	});

	test('flags an expect timeout above 5 s', () => {
		const src = `export default defineConfig({ expect: { timeout: 10_000 } });`;
		expect(rl(configTimeoutFindings(PCFG, src))).toEqual([[UN, 1]]);
	});

	test('ignores webServer timeout', () => {
		const src = `export default defineConfig({ webServer: { command: 'x', timeout: 30_000 } });`;
		expect(configTimeoutFindings(PCFG, src)).toEqual([]);
	});

	test('ignores globalTimeout', () => {
		const src = `export default defineConfig({ globalTimeout: 300_000 });`;
		expect(configTimeoutFindings(PCFG, src)).toEqual([]);
	});

	test('flags a project entry timeout above 30 s', () => {
		const src = `export default defineConfig({\n\tprojects: [{ name: 'x', timeout: 90_000 }]\n});`;
		expect(rl(configTimeoutFindings(PCFG, src))).toEqual([[UN, 2]]);
	});
});

describe('retryFindings', () => {
	test('flags a Vitest test retry option', () => {
		expect(rl(retryFindings(VT, `test('a', { retry: 2 }, fn);`))).toEqual([['retry', 1]]);
	});

	test('flags a Vitest describe retry option', () => {
		expect(rl(retryFindings(VT, `describe('d', { retry: 1 }, fn);`))).toEqual([['retry', 1]]);
	});

	test('flags retry in a Vitest config', () => {
		const src = `export default defineConfig({ test: { retry: 1 } });`;
		expect(rl(retryFindings(VCFG, src))).toEqual([['retry', 1]]);
	});

	test('flags Playwright describe.configure retries', () => {
		const src = `test.describe.configure({ retries: 2 });`;
		expect(rl(retryFindings(PW, src))).toEqual([['retry', 1]]);
	});

	test('accepts the pinned retries expression in the web config', () => {
		const src = `export default defineConfig({ retries: process.env.CI ? 1 : 0 });`;
		expect(retryFindings(PCFG, src)).toEqual([]);
	});

	test('flags a changed retries expression in the web config', () => {
		const src = `export default defineConfig({ retries: process.env.CI ? 2 : 0 });`;
		expect(rl(retryFindings(PCFG, src))).toEqual([['retry', 1]]);
	});

	test('accepts retries: 0 in the smoke config and flags retries: 1', () => {
		expect(retryFindings(SMOKE_CFG, `export default defineConfig({ retries: 0 });`)).toEqual([]);
		expect(rl(retryFindings(SMOKE_CFG, `export default defineConfig({ retries: 1 });`))).toEqual([
			['retry', 1]
		]);
	});

	test('an unknown Playwright config must have retries: 0', () => {
		const src = `export default defineConfig({ retries: 1 });`;
		expect(rl(retryFindings('apps/x/playwright.config.ts', src))).toEqual([['retry', 1]]);
	});

	test('flags --retries in a package.json script', () => {
		const src = `{\n\t"scripts": {\n\t\t"e2e": "playwright test --retries=2"\n\t}\n}`;
		expect(rl(retryFindings('apps/web/package.json', src))).toEqual([['retry', 3]]);
	});

	test('flags --retry in a package.json script', () => {
		const src = `{"scripts":{"t":"vitest run --retry 3"}}`;
		expect(rl(retryFindings('package.json', src))).toEqual([['retry', 1]]);
	});

	test('does not flag a plain package.json script', () => {
		expect(retryFindings('package.json', `{"scripts":{"t":"vitest run"}}`)).toEqual([]);
	});

	test('flags --retries on a workflow run line', () => {
		const src = `steps:\n  - run: pnpm exec playwright test --retries 1`;
		expect(rl(retryFindings('.github/workflows/ci.yml', src))).toEqual([['retry', 2]]);
	});

	test('flags a quoted --retries spawn argument in scripts/*.mjs', () => {
		const src = `spawn('npx', ['playwright', 'test', '--retries=1']);`;
		expect(rl(retryFindings('scripts/smoke.mjs', src))).toEqual([['retry', 1]]);
	});

	test('flags --retries inside a template literal in scripts/*.mjs', () => {
		const src = 'const cmd = `playwright test --retries=${n}`;';
		expect(rl(retryFindings('scripts/smoke.mjs', src))).toEqual([['retry', 1]]);
	});

	test('does not flag --retries mentioned in a scripts/*.mjs comment', () => {
		const src = `// never pass --retries=1 here\n/** or \`--retry\` either */\nconst x = 1;`;
		expect(retryFindings('scripts/smoke.mjs', src)).toEqual([]);
	});

	test('does not flag --retries in a workflow comment line', () => {
		const src = `steps:\n  # --fail-on-flaky-tests: no --retries here\n  - run: pnpm test:unit`;
		expect(retryFindings('.github/workflows/ci.yml', src)).toEqual([]);
	});

	test('does not flag product code named retry in a Vitest test', () => {
		expect(retryFindings(VT, `out.retry();`)).toEqual([]);
	});

	test('does not flag test.info().retry in a Playwright spec', () => {
		expect(retryFindings(PW, `const n = test.info().retry;`)).toEqual([]);
	});

	test('accepts the pinned retries expression in the extension config', () => {
		const src = `export default defineConfig({ retries: process.env.CI ? 1 : 0 });`;
		expect(retryFindings('apps/extension/playwright.config.ts', src)).toEqual([]);
	});
});

describe('toPassFindings', () => {
	const BUYBOX = 'apps/web/tests/e2e/investor/buybox.spec.ts';
	const ONE = `await expect(async () => {\n\tawait x();\n}).toPass();`;

	test('one toPass at an allowlisted site is fine', () => {
		expect(toPassFindings(BUYBOX, ONE)).toEqual([]);
	});

	test('a second toPass at an allowlisted site is flagged', () => {
		expect(rl(toPassFindings(BUYBOX, `${ONE}\n${ONE}`))).toEqual([['to-pass', 6]]);
	});

	test('one toPass anywhere else is flagged', () => {
		expect(rl(toPassFindings('apps/web/tests/e2e/other.spec.ts', ONE))).toEqual([['to-pass', 3]]);
	});
});

describe('scanFile routing', () => {
	const rulesOf = (f: Finding[]) => [...new Set(f.map((x) => x.rule))].sort();
	const VITEST_SRC = [
		`const t = performance.now();`,
		`test('a', { timeout: 30_000, retry: 1 }, () => {});`
	].join('\n');

	test('a parallel Vitest test runs elapsed + timeout + retry', () => {
		expect(rulesOf(scanFile('packages/core/src/z.test.ts', VITEST_SRC, SERIAL))).toEqual([
			'elapsed-time',
			'raised-timeout-outside-serial',
			'retry'
		]);
	});

	test('a serial Vitest test skips elapsed and reports unannotated raises', () => {
		expect(rulesOf(scanFile('packages/core/src/a.test.ts', VITEST_SRC, SERIAL))).toEqual([
			'retry',
			'unannotated-raise'
		]);
	});

	test('a Playwright spec runs playwright timeout + retry + toPass', () => {
		const src = [
			`test.slow();`,
			`test.describe.configure({ retries: 2 });`,
			`await expect(async () => {}).toPass();`
		].join('\n');
		expect(rulesOf(scanFile(PW, src, SERIAL))).toEqual(['retry', 'to-pass', 'unannotated-raise']);
	});

	test('a Vitest config runs config timeout + retry', () => {
		const src = `export default defineConfig({ test: { testTimeout: 60_000, retry: 1 } });`;
		expect(rulesOf(scanFile(VCFG, src, SERIAL))).toEqual(['retry', 'unannotated-raise']);
	});

	test('a Playwright config runs config timeout + retry', () => {
		const src = `export default defineConfig({ timeout: 60_000, retries: 1 });`;
		expect(rulesOf(scanFile(PCFG, src, SERIAL))).toEqual(['retry', 'unannotated-raise']);
	});

	test('package.json, workflows and scripts/*.mjs run retry only', () => {
		const pkg = `{"scripts":{"t":"vitest run --retry 3"}}`;
		expect(rulesOf(scanFile('package.json', pkg, SERIAL))).toEqual(['retry']);
		const wf = `run: pnpm exec playwright test --retries 1`;
		expect(rulesOf(scanFile('.github/workflows/ci.yml', wf, SERIAL))).toEqual(['retry']);
		const mjs = `spawn('npx', ['playwright', 'test', '--retries=1']);`;
		expect(rulesOf(scanFile('scripts/smoke.mjs', mjs, SERIAL))).toEqual(['retry']);
	});

	test('an unknown kind yields no findings', () => {
		expect(scanFile('README.md', `test.slow(); --retries=1`, SERIAL)).toEqual([]);
	});

	test('every finding carries the path, a 1-based line and a detail string', () => {
		for (const f of scanFile('packages/core/src/z.test.ts', VITEST_SRC, SERIAL)) {
			expect(f.path).toBe('packages/core/src/z.test.ts');
			expect(f.line).toBeGreaterThanOrEqual(1);
			expect(typeof f.detail).toBe('string');
			expect(f.detail.length).toBeGreaterThan(0);
		}
	});
});
