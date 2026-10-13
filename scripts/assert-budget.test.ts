// Tests for scripts/assert-budget.mjs: the initial-JS budget is measured from built HTML exactly the
// way a browser loads a route up front (modulepreload + boot-script imports + script src), and the
// 60 KB tool-page gate is proven non-vacuous with a planted incompressible 200 KB chunk. Fixtures live
// only under os.tmpdir().
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, describe, expect, test } from 'vitest';
import { BUDGET_BYTES, checkBudget, initialCss, initialJs } from './assert-budget.mjs';

type Files = Record<string, string | Buffer>;

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function build(files: Files): string {
	const dir = mkdtempSync(join(tmpdir(), 'tran-budget-'));
	roots.push(dir);
	for (const [rel, content] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true });
		writeFileSync(join(dir, rel), content);
	}
	return dir;
}

const gz = (b: string | Buffer) => gzipSync(b, { level: 9 }).length;

/** A Kit-shaped page: modulepreload links, a stylesheet, frame-guard and an inline boot script. */
function page(prefix: string, extraPreload: string[] = []): string {
	const pre = [
		'_app/immutable/entry/start.js',
		'_app/immutable/chunks/runtime.js',
		...extraPreload
	];
	return `<!doctype html>
<html lang="en" hidden>
	<head>
		<meta charset="utf-8" />
		<link href="${prefix}_app/immutable/assets/app.css" rel="stylesheet" />
		${pre.map((p) => `<link rel="modulepreload" href="${prefix}${p}" />`).join('\n\t\t')}
		<script src="${prefix}frame-guard.js"></script>
	</head>
	<body>
		<div>
			<script>
				{
					__sveltekit_x = { base: new URL("${prefix || '.'}", location).pathname.slice(0, -1) };
					Promise.all([
						import("${prefix}_app/immutable/entry/start.js"),
						import("${prefix}_app/immutable/entry/app.js")
					]).then(([kit, app]) => kit.start(app, document.body));
				}
			</script>
		</div>
	</body>
</html>
`;
}

const START = 'export function start() {}\n'.repeat(40);
const RUNTIME = 'export const runtime = "svelte";\n'.repeat(80);
const APP = 'export const nodes = [];\n'.repeat(20);
const FRAME = 'if (top !== self) top.location = self.location;\n';
const CSS = 'body { color: #222; margin: 0 }\n'.repeat(50);

function golden(chunk: Buffer): Files {
	return {
		'_app/immutable/entry/start.js': START,
		'_app/immutable/entry/app.js': APP,
		'_app/immutable/chunks/runtime.js': RUNTIME,
		'_app/immutable/chunks/tool.js': chunk,
		'_app/immutable/assets/app.css': CSS,
		'frame-guard.js': FRAME,
		'index.html': page('./'),
		'tools/index.html': page('../'),
		'tools/x/index.html': page('../../', ['_app/immutable/chunks/tool.js']),
		'for-renters/index.html': page('../'),
		'renter/index.html': page('../')
	};
}

describe('initialJs', () => {
	test('sums gzip -9 sizes of modulepreloads, boot-script imports and script src, each once', () => {
		const chunk = Buffer.from('export const tool = 1;\n'.repeat(30));
		const dir = build(golden(chunk));
		const expected = gz(START) + gz(RUNTIME) + gz(chunk) + gz(FRAME) + gz(APP);
		expect(initialJs(dir, 'tools/x/index.html')).toBe(expected);
		// start.js is both modulepreloaded and imported by the boot script: counted once.
		expect(initialJs(dir, 'index.html')).toBe(gz(START) + gz(RUNTIME) + gz(FRAME) + gz(APP));
	});

	test('refs resolve relative to the page directory', () => {
		const dir = build(golden(Buffer.from('x')));
		expect(initialJs(dir, 'tools/x/index.html')).toBeGreaterThan(
			initialJs(dir, 'tools/index.html')
		);
	});

	test('a referenced file that does not exist is an error, never 0', () => {
		const files = golden(Buffer.from('x'));
		delete files['_app/immutable/chunks/runtime.js'];
		const dir = build(files);
		expect(() => initialJs(dir, 'index.html')).toThrow(/runtime\.js/);
		const { errors } = checkBudget(dir);
		expect(errors).toContainEqual(expect.stringMatching(/^tools\/x\/index\.html: .*runtime\.js/));
	});

	test('a missing dynamic import target in the boot script is an error', () => {
		const files = golden(Buffer.from('x'));
		delete files['_app/immutable/entry/app.js'];
		expect(() => initialJs(build(files), 'index.html')).toThrow(/app\.js/);
	});
});

describe('initialCss', () => {
	test('sums gzip sizes of link rel=stylesheet hrefs', () => {
		const dir = build(golden(Buffer.from('x')));
		expect(initialCss(dir, 'tools/x/index.html')).toBe(gz(CSS));
	});
});

describe('checkBudget', () => {
	test('BUDGET_BYTES is 60 KB', () => {
		expect(BUDGET_BYTES).toBe(60 * 1024);
	});

	test('a planted 200 KB incompressible chunk on a tools page fails, naming route, KB and budget', () => {
		const dir = build(golden(randomBytes(200 * 1024)));
		const { rows, errors } = checkBudget(dir);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatch(
			/^tools\/x\/index\.html: initial JS 2\d\d\.\d KB gz exceeds the 60 KB budget/
		);
		expect(rows.find((r) => r.route === 'tools/x/index.html')).toMatchObject({
			budget: BUDGET_BYTES,
			result: 'FAIL'
		});
		expect(rows.find((r) => r.route === 'tools/index.html')?.result).toBe('PASS');
	});

	test('the same fixture with a 1 KB chunk passes', () => {
		const dir = build(golden(randomBytes(1024)));
		const { rows, errors } = checkBudget(dir);
		expect(errors).toEqual([]);
		const tool = rows.find((r) => r.route === 'tools/x/index.html');
		expect(tool).toMatchObject({ budget: BUDGET_BYTES, result: 'PASS' });
		expect(tool?.jsGz).toBe(initialJs(dir, 'tools/x/index.html'));
		expect(tool?.cssGz).toBe(gz(CSS));
	});

	test('a landing page over 60 KB is a REPORT row and does not fail', () => {
		const files = golden(randomBytes(1024));
		files['_app/immutable/chunks/landing.js'] = randomBytes(200 * 1024);
		files['index.html'] = page('./', ['_app/immutable/chunks/landing.js']);
		files['for-renters/index.html'] = page('../', ['_app/immutable/chunks/landing.js']);
		const { rows, errors } = checkBudget(build(files));
		expect(errors).toEqual([]);
		const landing = rows.find((r) => r.route === 'index.html');
		expect(landing).toMatchObject({ budget: null, result: 'REPORT' });
		expect(landing?.jsGz).toBeGreaterThan(BUDGET_BYTES);
		expect(rows.find((r) => r.route === 'for-renters/index.html')?.result).toBe('REPORT');
	});

	test('routes outside the HARD and REPORT lists are skipped', () => {
		const { rows } = checkBudget(build(golden(Buffer.from('x'))));
		expect(rows.map((r) => r.route).sort()).toEqual([
			'for-renters/index.html',
			'index.html',
			'tools/index.html',
			'tools/x/index.html'
		]);
	});

	test('a custom limit is honoured', () => {
		const { errors } = checkBudget(build(golden(Buffer.from('x'))), { limit: 100 });
		expect(errors).toHaveLength(2);
	});
});
