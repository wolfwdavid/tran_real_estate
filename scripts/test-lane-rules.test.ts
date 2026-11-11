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

// ---------------------------------------------------------------------------------------------
// Plan 16-02, task 1: CR-01 (zero and negative timeouts) and WR-02 (options by reference).
// Every planted source is a template literal. Each "flagged" case has a negative control.

describe('CR-01: a timeout of 0 (or below) is the largest raise', () => {
	const OUT = 'raised-timeout-outside-serial';
	const UN = 'unannotated-raise';

	test('Vitest test options timeout: 0 is flagged; timeout: 1 is not', () => {
		expect(rl(vitestTimeoutFindings(VT, `test('a', { timeout: 0 }, () => {});`, NODE))).toEqual([
			[OUT, 1]
		]);
		expect(vitestTimeoutFindings(VT, `test('a', { timeout: 1 }, () => {});`, NODE)).toEqual([]);
	});

	test('a trailing Vitest timeout of 0 is flagged', () => {
		expect(rl(vitestTimeoutFindings(VT, `test('a', () => {}, 0);`, NODE))).toEqual([[OUT, 1]]);
	});

	test('expect.poll with timeout: 0 is flagged', () => {
		const src = `await expect.poll(() => x(), { timeout: 0 }).toBe(1);`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
	});

	test('a negative Vitest timeout is flagged', () => {
		expect(rl(vitestTimeoutFindings(VT, `test('a', { timeout: -1 }, () => {});`, NODE))).toEqual([
			[OUT, 1]
		]);
	});

	test('a hook trailing timeout of 0 is flagged', () => {
		expect(rl(vitestTimeoutFindings(VT, `beforeAll(async () => {}, 0);`, NODE))).toEqual([
			[OUT, 1]
		]);
	});

	test('Playwright test.setTimeout(0) is flagged; setTimeout(30_000) is not', () => {
		expect(rl(playwrightTimeoutFindings(PW, `test.setTimeout(0);`))).toEqual([[UN, 1]]);
		expect(playwrightTimeoutFindings(PW, `test.setTimeout(30_000);`)).toEqual([]);
	});

	test('Playwright expect timeout: 0 is flagged', () => {
		const src = `await expect(l).toBeVisible({ timeout: 0 });`;
		expect(rl(playwrightTimeoutFindings(PW, src))).toEqual([[UN, 1]]);
		expect(
			playwrightTimeoutFindings(PW, `await expect(l).toBeVisible({ timeout: 1_000 });`)
		).toEqual([]);
	});

	test('Playwright describe.configure timeout: 0 is flagged', () => {
		const src = `test.describe.configure({ timeout: 0 });`;
		expect(rl(playwrightTimeoutFindings(PW, src))).toEqual([[UN, 1]]);
	});

	test('Vitest config testTimeout: 0 and hookTimeout: 0 are flagged', () => {
		const cfg = (b: string) => `export default defineConfig({\n\ttest: {\n${b}\n\t}\n});`;
		expect(rl(configTimeoutFindings(VCFG, cfg(`\t\ttestTimeout: 0`)))).toEqual([[UN, 3]]);
		expect(rl(configTimeoutFindings(VCFG, cfg(`\t\thookTimeout: 0`)))).toEqual([[UN, 3]]);
		expect(configTimeoutFindings(VCFG, cfg(`\t\ttestTimeout: 1`))).toEqual([]);
	});

	test('Playwright config timeout: 0 and expect timeout: 0 are flagged', () => {
		expect(rl(configTimeoutFindings(PCFG, `export default defineConfig({ timeout: 0 });`))).toEqual(
			[[UN, 1]]
		);
		expect(
			rl(configTimeoutFindings(PCFG, `export default defineConfig({ expect: { timeout: 0 } });`))
		).toEqual([[UN, 1]]);
		expect(
			configTimeoutFindings(PCFG, `export default defineConfig({ expect: { timeout: 1 } });`)
		).toEqual([]);
	});

	test('an annotated serial raise to 0 still needs the annotation', () => {
		const SP = 'apps/web/src/lib/b.test.ts';
		const src = `test('a', { timeout: 0 }, () => {});`;
		expect(rl(vitestTimeoutFindings(SP, src, SERIAL_NODE))).toEqual([[UN, 1]]);
		expect(vitestTimeoutFindings(SP, NOTE + src, SERIAL_NODE)).toEqual([]);
	});
});

describe('WR-02: timeouts and retries passed by reference, spread or shorthand', () => {
	const OUT = 'raised-timeout-outside-serial';
	const UN = 'unannotated-raise';

	test('Vitest options held in a const are flagged', () => {
		const src = `const o = { timeout: 600000 };\ntest('a', o, fn);`;
		expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 2]]);
	});

	test('a spread inside the inline Vitest options is flagged', () => {
		expect(rl(vitestTimeoutFindings(VT, `test('a', { ...o }, fn);`, NODE))).toEqual([[OUT, 1]]);
	});

	test('a callback held in an identifier with a trailing timeout is flagged', () => {
		expect(rl(vitestTimeoutFindings(VT, `test('a', run, 600000);`, NODE))).toEqual([[OUT, 1]]);
	});

	test('a wrapped callback with a trailing timeout is flagged', () => {
		expect(rl(vitestTimeoutFindings(VT, `test('a', wrap(fn), 600000);`, NODE))).toEqual([[OUT, 1]]);
	});

	test('a hook whose callback is an identifier keeps its trailing timeout checked', () => {
		expect(rl(vitestTimeoutFindings(VT, `beforeAll(setup, 600000);`, NODE))).toEqual([[OUT, 1]]);
		expect(vitestTimeoutFindings(VT, `beforeAll(setup, 5000);`, NODE)).toEqual([]);
		expect(vitestTimeoutFindings(VT, `beforeAll(setup);`, NODE)).toEqual([]);
	});

	test('expect.poll with options passed by reference is flagged', () => {
		expect(rl(vitestTimeoutFindings(VT, `await expect.poll(fn, opts).toBe(1);`, NODE))).toEqual([
			[OUT, 1]
		]);
	});

	test('a trailing timeout held in an identifier after an identifier callback is flagged', () => {
		expect(rl(vitestTimeoutFindings(VT, `test('a', run, MS);`, NODE))).toEqual([[OUT, 1]]);
	});

	test('negative controls: no options at all stays silent', () => {
		expect(vitestTimeoutFindings(VT, `test('a', fn);`, NODE)).toEqual([]);
		expect(vitestTimeoutFindings(VT, `test('a', () => {});`, NODE)).toEqual([]);
		expect(vitestTimeoutFindings(VT, `test('a', { timeout: 1000 }, run);`, NODE)).toEqual([]);
		expect(vitestTimeoutFindings(VT, `test.each([1])('a', run);`, NODE)).toEqual([]);
		expect(vitestTimeoutFindings(VT, `await expect.poll(fn).toBe(1);`, NODE)).toEqual([]);
	});

	test('Prettier-wrapped variants are flagged on the first line of the chain', () => {
		expect(
			rl(vitestTimeoutFindings(VT, `await expect\n\t.poll(fn, opts)\n\t.toBe(1);`, NODE))
		).toEqual([[OUT, 1]]);
		expect(rl(vitestTimeoutFindings(VT, `test\n\t.concurrent('a', run, 600000);`, NODE))).toEqual([
			[OUT, 1]
		]);
		expect(rl(vitestTimeoutFindings(VT, `beforeAll(\n\tsetup,\n\t600000\n);`, NODE))).toEqual([
			[OUT, 1]
		]);
		expect(
			rl(vitestTimeoutFindings(VT, `test\n\t.skipIf(c)('a', {\n\t\t...o\n\t}, fn);`, NODE))
		).toEqual([[OUT, 1]]);
	});

	test('in the serial lane a by-reference option still needs the annotation', () => {
		const SP = 'apps/web/src/lib/b.test.ts';
		const src = `test('a', run, 600000);`;
		expect(rl(vitestTimeoutFindings(SP, src, SERIAL_NODE))).toEqual([[UN, 1]]);
		expect(vitestTimeoutFindings(SP, NOTE + src, SERIAL_NODE)).toEqual([]);
	});

	test('retry options held in a const or spread are flagged', () => {
		expect(rl(retryFindings(VT, `const o = { retry: 3 };\ntest('a', o, fn);`))).toContainEqual([
			'retry',
			2
		]);
		expect(rl(retryFindings(VT, `test('a', { ...o }, fn);`))).toEqual([['retry', 1]]);
		expect(retryFindings(VT, `test('a', fn);`)).toEqual([]);
		expect(retryFindings(VT, `test('a', { timeout: 100 }, run);`)).toEqual([]);
	});

	test('a shorthand retry or retries property is flagged', () => {
		expect(rl(retryFindings(VCFG, `export default defineConfig({ test: { retry } });`))).toEqual([
			['retry', 1]
		]);
		expect(rl(retryFindings(PCFG, `export default defineConfig({ retries });`))).toEqual([
			['retry', 1]
		]);
		expect(retryFindings(PCFG, `export default defineConfig({ workers: 1 });`)).toEqual([]);
	});

	test('a shorthand testTimeout is flagged in a Vitest config', () => {
		const src = `const testTimeout = 99999;\nexport default defineConfig({ test: { testTimeout } });`;
		expect(rl(configTimeoutFindings(VCFG, src))).toEqual([[UN, 2]]);
	});

	test('a defineConfig argument that is not an object literal is a finding', () => {
		const src = `const c = { retries: 5 };\nexport default defineConfig(c);`;
		expect(rl(configTimeoutFindings(PCFG, src))).toEqual([[UN, 2]]);
		expect(rl(retryFindings(PCFG, src))).toEqual([['retry', 1]]);
		expect(
			configTimeoutFindings(VCFG, `export default defineConfig({ test: { name: 'x' } });`)
		).toEqual([]);
	});

	test('Playwright matcher options passed by reference are flagged', () => {
		expect(rl(playwrightTimeoutFindings(PW, `await expect(l).toBeVisible(opts);`))).toEqual([
			[UN, 1]
		]);
		expect(rl(playwrightTimeoutFindings(PW, `await expect(l).toHaveText('x', opts);`))).toEqual([
			[UN, 1]
		]);
		expect(rl(playwrightTimeoutFindings(PW, `await expect(l).toBeVisible({ ...o });`))).toEqual([
			[UN, 1]
		]);
		expect(playwrightTimeoutFindings(PW, `await expect(l).toBeVisible();`)).toEqual([]);
		expect(playwrightTimeoutFindings(PW, `expect(value).toBe(opts);`)).toEqual([]);
		expect(playwrightTimeoutFindings(PW, `await expect(l).toHaveText('x');`)).toEqual([]);
	});

	test('Playwright describe.configure and expect.configure with a reference are flagged', () => {
		expect(rl(playwrightTimeoutFindings(PW, `test.describe.configure(opts);`))).toEqual([[UN, 1]]);
		expect(rl(retryFindings(PW, `test.describe.configure(opts);`))).toEqual([['retry', 1]]);
		expect(rl(playwrightTimeoutFindings(PW, `expect.configure(opts);`))).toEqual([[UN, 1]]);
		expect(playwrightTimeoutFindings(PW, `test.describe.configure({ mode: 'serial' });`)).toEqual(
			[]
		);
	});

	test('Prettier-wrapped Playwright describe.configure(reference) is flagged', () => {
		expect(rl(playwrightTimeoutFindings(PW, `test.describe\n\t.configure(opts);`))).toEqual([
			[UN, 1]
		]);
	});
});

// ---------------------------------------------------------------------------------------------
// Plan 16-02, task 2: WR-03 (timeout-raising APIs) and WR-04 (lanes.ts, runner flags, workflow
// re-runs). Planted sources are template literals; each flagged case has a negative control.

describe('WR-03: timeout-raising APIs outside test.setTimeout', () => {
	const UN = 'unannotated-raise';
	const OUT = 'raised-timeout-outside-serial';
	const BROWSER_PATH = 'apps/web/src/lib/D.browser.test.ts';

	test.each([
		['page.setDefaultTimeout', `await page.setDefaultTimeout(600000);`],
		['page.setDefaultNavigationTimeout', `page.setDefaultNavigationTimeout(600000);`],
		['context.setDefaultTimeout', `context.setDefaultTimeout(600000);`],
		['testInfo.setTimeout', `testInfo.setTimeout(600000);`],
		['testInfo.slow', `testInfo.slow();`],
		['test.info().setTimeout', `test.info().setTimeout(600000);`],
		['setDefaultTimeout(0)', `page.setDefaultTimeout(0);`]
	])('%s is flagged by the Playwright rule', (_name, src) => {
		expect(rl(playwrightTimeoutFindings(PW, src))).toEqual([[UN, 1]]);
	});

	test('a Prettier-wrapped setDefaultTimeout is flagged', () => {
		expect(rl(playwrightTimeoutFindings(PW, `page\n\t.setDefaultTimeout(600000);`))).toEqual([
			[UN, 1]
		]);
	});

	test('negative controls: defaults and unrelated setTimeout stay silent', () => {
		expect(playwrightTimeoutFindings(PW, `page.setDefaultTimeout(5000);`)).toEqual([]);
		expect(playwrightTimeoutFindings(PW, `page.setDefaultNavigationTimeout(1);`)).toEqual([]);
		expect(playwrightTimeoutFindings(PW, `testInfo.setTimeout(30_000);`)).toEqual([]);
		expect(playwrightTimeoutFindings(PW, `window.setTimeout(r, 60_000);`)).toEqual([]);
		expect(playwrightTimeoutFindings(PW, `setTimeout(r, 60_000);`)).toEqual([]);
		expect(playwrightTimeoutFindings(PW, `const n = testInfo.retry;`)).toEqual([]);
	});

	test('an annotated setDefaultTimeout is accepted', () => {
		expect(playwrightTimeoutFindings(PW, `${NOTE}page.setDefaultTimeout(600000);`)).toEqual([]);
	});

	test('a Playwright config expect.toPass.timeout above 5 s is flagged', () => {
		const src = `export default defineConfig({ expect: { toPass: { timeout: 600000 } } });`;
		expect(rl(configTimeoutFindings(PCFG, src))).toEqual([[UN, 1]]);
		const ok = `export default defineConfig({ expect: { toPass: { timeout: 5000 } } });`;
		expect(configTimeoutFindings(PCFG, ok)).toEqual([]);
	});

	test('a Vitest browser expect.element matcher with a raised timeout is flagged', () => {
		const src = `await expect.element(loc).toBeVisible({ timeout: 60000 });`;
		expect(rl(vitestTimeoutFindings(BROWSER_PATH, src, BROWSER))).toEqual([[OUT, 1]]);
		const ok = `await expect.element(loc).toBeVisible({ timeout: 500 });`;
		expect(vitestTimeoutFindings(BROWSER_PATH, ok, BROWSER)).toEqual([]);
	});

	test('a Vitest browser locator action with a raised timeout is flagged', () => {
		const src = `await page.getByRole('x').click({ timeout: 60000 });`;
		expect(rl(vitestTimeoutFindings(BROWSER_PATH, src, BROWSER))).toEqual([[OUT, 1]]);
		const wrapped = `await page\n\t.getByRole('x')\n\t.click({ timeout: 60000 });`;
		expect(rl(vitestTimeoutFindings(BROWSER_PATH, wrapped, BROWSER))).toEqual([[OUT, 1]]);
	});

	test('a Vitest browser timeout option of 0 is flagged; a node-lane spawn option is not', () => {
		const zero = `await page.getByRole('x').click({ timeout: 0 });`;
		expect(rl(vitestTimeoutFindings(BROWSER_PATH, zero, BROWSER))).toEqual([[OUT, 1]]);
		expect(vitestTimeoutFindings(VT, `spawnSync('git', [], { timeout: 30_000 });`, NODE)).toEqual(
			[]
		);
	});

	test('an alias of the test API is reported (fail closed)', () => {
		const ext = `const t = test.extend({});\nt('a', fn, 600000);`;
		expect(rl(vitestTimeoutFindings(VT, ext, NODE))).toEqual([[OUT, 1]]);
		const imp = `import { test as t } from 'vitest';\nt('a', fn, 600000);`;
		expect(rl(vitestTimeoutFindings(VT, imp, NODE))).toEqual([[OUT, 1]]);
		const hook = `import { beforeAll as setup } from 'vitest';`;
		expect(rl(vitestTimeoutFindings(VT, hook, NODE))).toEqual([[OUT, 1]]);
	});

	test('negative control: plain vitest imports are not aliases', () => {
		const src = `import { test, expect, vi as mock } from 'vitest';\ntest('a', () => {});`;
		expect(vitestTimeoutFindings(VT, src, NODE)).toEqual([]);
	});
});

describe('WR-04: lanes.ts, config extensions and runner flags', () => {
	const UN = 'unannotated-raise';
	const CLI = 'cli-timeout-or-workers';
	const WF = '.github/workflows/ci.yml';

	test('tooling/vitest/lanes.ts is a vitest-config, so serialTest() is scanned', () => {
		expect(fileKind('tooling/vitest/lanes.ts')).toBe('vitest-config');
		const src = `export const serialTest = () => ({ testTimeout: 600000, retry: 3 });`;
		expect(rl(configTimeoutFindings('tooling/vitest/lanes.ts', src))).toEqual([[UN, 1]]);
		expect(rl(retryFindings('tooling/vitest/lanes.ts', src))).toEqual([['retry', 1]]);
		const clean = `export const serialTest = () => ({ fileParallelism: false, maxWorkers: 1 });`;
		expect(scanFile('tooling/vitest/lanes.ts', clean, SERIAL)).toEqual([]);
	});

	test('mts, cts, js and mjs configs and vitest.workspace files are classified', () => {
		expect(fileKind('vitest.config.mts')).toBe('vitest-config');
		expect(fileKind('apps/web/vitest.config.js')).toBe('vitest-config');
		expect(fileKind('apps/web/vite.config.cts')).toBe('vitest-config');
		expect(fileKind('packages/core/vitest.serial.config.mjs')).toBe('vitest-config');
		expect(fileKind('vitest.workspace.ts')).toBe('vitest-config');
		expect(fileKind('vitest.workspace.mts')).toBe('vitest-config');
		expect(fileKind('apps/web/playwright.config.mts')).toBe('playwright-config');
		expect(fileKind('apps/web/playwright.smoke.config.js')).toBe('playwright-config');
	});

	test('negative controls: a test about a config is still a test, a plain ts file is null', () => {
		expect(fileKind('scripts/vitest.config.test.ts')).toBe('vitest-test');
		expect(fileKind('tooling/vitest/no-network.ts')).toBeNull();
		expect(fileKind('apps/web/src/lib/vitest-helpers.ts')).toBeNull();
	});

	test.each([
		['--testTimeout=60000', CLI],
		['--testTimeout 60000', CLI],
		['--hookTimeout=60000', CLI],
		['--test-timeout=60000', CLI],
		['--hook-timeout=60000', CLI],
		['--timeout=60000', CLI],
		['--workers=8', CLI],
		['--maxWorkers=8', CLI],
		['--max-workers=8', CLI],
		['--retry=2', 'retry'],
		['--retries=2', 'retry']
	])('%s in a package.json script is flagged as %s', (flag, rule) => {
		const src = `{\n\t"scripts": {\n\t\t"t": "vitest run ${flag}"\n\t}\n}`;
		expect(rl(retryFindings('package.json', src))).toEqual([[rule, 3]]);
	});

	test('the same flags are flagged in a workflow line and in a scripts/*.mjs string', () => {
		const wf = `steps:\n  - run: pnpm exec playwright test --workers=8`;
		expect(rl(retryFindings(WF, wf))).toEqual([[CLI, 2]]);
		const mjs = `spawn('npx', ['playwright', 'test', '--timeout=60000']);`;
		expect(rl(retryFindings('scripts/smoke.mjs', mjs))).toEqual([[CLI, 1]]);
		const tpl = 'const cmd = `vitest run --testTimeout=${ms}`;';
		expect(rl(retryFindings('scripts/smoke.mjs', tpl))).toEqual([[CLI, 1]]);
	});

	test('negative controls: similar flags and plain scripts stay silent', () => {
		expect(retryFindings('package.json', `{"scripts":{"t":"vitest run"}}`)).toEqual([]);
		expect(
			retryFindings('package.json', `{"scripts":{"t":"gh run watch --timeout-minutes 5"}}`)
		).toEqual([]);
		expect(retryFindings('package.json', `{"scripts":{"t":"x --workersX"}}`)).toEqual([]);
		expect(retryFindings('scripts/smoke.mjs', `// never pass --workers=8\nconst x = 1;`)).toEqual(
			[]
		);
		expect(retryFindings(WF, `steps:\n  # no --workers=8 here\n  - run: pnpm test:unit`)).toEqual(
			[]
		);
	});

	test('continue-on-error on a step is flagged; false is not', () => {
		const on = `steps:\n  - run: pnpm test:unit\n    continue-on-error: true`;
		expect(rl(retryFindings(WF, on))).toEqual([['workflow-rerun', 3]]);
		const expr = `steps:\n  - run: pnpm test:unit\n    continue-on-error: \${{ matrix.x }}`;
		expect(rl(retryFindings(WF, expr))).toEqual([['workflow-rerun', 3]]);
		const off = `steps:\n  - run: pnpm test:unit\n    continue-on-error: false`;
		expect(retryFindings(WF, off)).toEqual([]);
		const note = `steps:\n  # continue-on-error: true would hide failures\n  - run: pnpm test:unit`;
		expect(retryFindings(WF, note)).toEqual([]);
	});

	test('a "||" re-run on a test run line is flagged', () => {
		const one = `steps:\n  - run: pnpm test:unit || pnpm test:unit`;
		expect(rl(retryFindings(WF, one))).toEqual([['workflow-rerun', 2]]);
		const masked = `steps:\n  run: pnpm exec playwright test || true`;
		expect(rl(retryFindings(WF, masked))).toEqual([['workflow-rerun', 2]]);
		const block = `steps:\n  - run: |\n      pnpm install\n      pnpm test:unit || pnpm test:unit`;
		expect(rl(retryFindings(WF, block))).toEqual([['workflow-rerun', 4]]);
		const smoke = `steps:\n  - run: pnpm smoke || pnpm smoke`;
		expect(rl(retryFindings(WF, smoke))).toEqual([['workflow-rerun', 2]]);
	});

	test('negative controls: "||" in expressions, non-test commands and package.json prepare', () => {
		const expr = `jobs:\n  a:\n    if: \${{ a && b || c }}\n    steps:\n      - run: pnpm test:unit`;
		expect(retryFindings(WF, expr)).toEqual([]);
		const inRun = `steps:\n  - run: pnpm test:unit --reporter \${{ vars.R || 'dot' }}`;
		expect(retryFindings(WF, inRun)).toEqual([]);
		const notTest = `steps:\n  - run: pnpm install || echo ''`;
		expect(retryFindings(WF, notTest)).toEqual([]);
		const env = `steps:\n  - run: pnpm test:unit\n    env:\n      X: \${{ vars.A || '' }}`;
		expect(retryFindings(WF, env)).toEqual([]);
		const prepare = `{"scripts":{"prepare":"wxt prepare || echo ''"}}`;
		expect(retryFindings('apps/extension/package.json', prepare)).toEqual([]);
	});

	test('a block scalar ends at the next key, so a later "||" line is not a run line', () => {
		const src = `steps:\n  - run: |\n      pnpm test:unit\n    name: x\n    other: pnpm test:unit || true`;
		expect(retryFindings(WF, src)).toEqual([]);
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
