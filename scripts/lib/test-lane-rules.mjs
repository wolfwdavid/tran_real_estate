// Phase 15 test-lane rules (TEST-01/TEST-02/TEST-03). Pure functions over {path, text}; no file
// system access. Rules: elapsed time outside the serial lane, raised timeouts outside the serial
// lane, raised timeouts without a 'measured <n> <unit>' + 'cause' comment, retries. Consumers:
// scripts/test-lanes.test.ts (repo sweep), Phase 15 annotation plans.
//
// Detection is the TypeScript compiler API (precedent: apps/web/src/lib/ai/import-graph.ts), not
// regex, except for the retry flags in package.json scripts, workflow lines and scripts/*.mjs.
// Non-literal timeout values (identifiers, arithmetic) always count as raised: the guard cannot
// prove them small, so it fails closed. All paths are repo-relative POSIX; `line` is 1-based.
import ts from 'typescript';

/**
 * Resolved defaults per API (Vitest 4.1.12 node/browser projects, Playwright 1.63.0). A timeout is
 * "raised" when it is above the default for its lane, or when its value is not a numeric literal.
 */
export const DEFAULTS = Object.freeze({
	nodeTest: 5000,
	browserTest: 15000,
	nodeHook: 10000,
	browserHook: 30000,
	wait: 1000,
	pwTest: 30000,
	pwExpect: 5000
});

/** The annotation needs "measured" followed by a number and a unit on the same line. */
export const MEASURED = /\bmeasured\b[^\n]*?\d+(?:\.\d+)?\s*(?:ms|s|min)\b/i;
/** ...and the word "cause" somewhere in the same comment block. */
export const CAUSE = /\bcause\b/i;

/** Pre-existing, justified `.toPass()` sites (Inventory C). Anything beyond these is a finding. */
export const TO_PASS_ALLOWLIST = Object.freeze({
	'apps/web/tests/e2e/investor/buybox.spec.ts': 1,
	'apps/web/tests/e2e/investor/demo.spec.ts': 1
});

/** Exact `retries` initializer text each Playwright config must keep. Unknown configs: `0`. */
export const PINNED_RETRIES = Object.freeze({
	'apps/web/playwright.config.ts': 'process.env.CI ? 1 : 0',
	'apps/extension/playwright.config.ts': 'process.env.CI ? 1 : 0',
	'apps/web/playwright.smoke.config.ts': '0'
});

/**
 * @typedef {{ path: string; line: number; rule: 'elapsed-time'|'raised-timeout-outside-serial'|'unannotated-raise'|'retry'|'to-pass'; detail: string }} Finding
 * @typedef {{ project: string; serial: boolean; browser: boolean }} Lane
 * @typedef {Record<string, readonly { file: string }[]>} SerialManifest shape of SERIAL in tooling/vitest/lanes.ts
 * @typedef {'vitest-test'|'playwright'|'vitest-config'|'playwright-config'|'package-json'|'workflow'|'script-mjs'} FileKind
 */

const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]s$/;
const BROWSER_FILE = /\.browser\.test\.[cm]?[jt]s$/;
const TEST_ROOTS = new Set(['test', 'it', 'describe', 'suite']);
/** Chain members that keep `test.<x>(...)` a Vitest test API (`it.next().then` is not one). */
const TEST_MODIFIERS = new Set([
	'each',
	'for',
	'only',
	'skip',
	'todo',
	'fails',
	'concurrent',
	'sequential',
	'shuffle',
	'skipIf',
	'runIf'
]);
const HOOKS = new Set(['beforeAll', 'beforeEach', 'afterAll', 'afterEach']);
const WAITS = new Set(['vi.waitFor', 'vi.waitUntil', 'expect.poll', 'expect.element']);
const ELAPSED_CALLEES = new Set(['performance.now', 'process.hrtime', 'process.hrtime.bigint']);
const RETRY_FLAG = /--retr(?:y|ies)\b/;

/**
 * Vitest project roots in resolution order. `browser` projects claim `.browser.test.ts` files;
 * the sibling node project claims the rest under the same prefix.
 * @type {ReadonlyArray<readonly [prefix: string, node: string, browser: string | null]>}
 */
const PROJECTS = [
	['packages/core/', 'core', null],
	['packages/brand/', 'brand', null],
	['apps/web/src/', 'web', 'web-browser'],
	['apps/extension/', 'extension', 'extension-browser'],
	['scripts/', 'scripts', null]
];

/**
 * Maps a repo-relative path to its Vitest project and serial membership, or null when no Vitest
 * project owns it (Playwright specs, docs, node_modules).
 * @param {string} path
 * @param {SerialManifest} serial
 * @returns {Lane | null}
 */
export function laneOf(path, serial) {
	if (path.includes('node_modules/') || !TEST_FILE.test(path)) return null;
	for (const [prefix, node, browser] of PROJECTS) {
		if (!path.startsWith(prefix)) continue;
		if (prefix === 'apps/extension/' && path.startsWith('apps/extension/e2e/')) return null;
		const isBrowser = browser !== null && BROWSER_FILE.test(path);
		const project = isBrowser ? /** @type {string} */ (browser) : node;
		const root = prefix === 'apps/web/src/' ? 'apps/web/' : prefix;
		const listed = (serial[project] ?? []).some((e) => root + e.file === path);
		return { project, serial: listed, browser: isBrowser };
	}
	return null;
}

/**
 * Classifies a repo-relative path for `scanFile`. Order matters: configs before tests, tests before
 * the text-only kinds.
 * @param {string} path
 * @returns {FileKind | null}
 */
export function fileKind(path) {
	if (path.includes('node_modules/')) return null;
	if (/(^|\/)playwright[\w.-]*\.config\.ts$/.test(path)) return 'playwright-config';
	if (/(^|\/)vite(?:st)?(?:\.[\w-]+)*\.config\.ts$/.test(path)) return 'vitest-config';
	if (/^apps\/web\/tests\/.+\.ts$/.test(path) || /^apps\/extension\/e2e\/.+\.ts$/.test(path)) {
		return 'playwright';
	}
	if (laneOf(path, {}) !== null) return 'vitest-test';
	if (/(^|\/)package\.json$/.test(path)) return 'package-json';
	if (/^\.github\/workflows\/.+\.ya?ml$/.test(path)) return 'workflow';
	if (/^scripts\/.+\.mjs$/.test(path)) return 'script-mjs';
	return null;
}

// ---------------------------------------------------------------------------------------------
// AST helpers

/** @param {string} path @param {string} text */
const parse = (path, text) =>
	ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** @param {ts.SourceFile} sf @param {ts.Node} n */
const lineOf = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/**
 * Numeric literal value (underscore separators stripped), or null for anything the guard cannot
 * prove: identifiers, arithmetic, template literals, casts.
 * @param {ts.Node | undefined} n
 * @returns {number | null}
 */
const numberOf = (n) =>
	n !== undefined && ts.isNumericLiteral(n) ? Number(n.text.replace(/_/g, '')) : null;

/** @param {number | null} value @param {number} max */
const isRaised = (value, max) => value === null || value > max;

/** @param {ts.Node} n @param {ts.SourceFile} sf */
const valueText = (n, sf) => (ts.isNumericLiteral(n) ? n.text : `${n.getText(sf)} (non-literal)`);

/**
 * Walks `a.b.c(...)(...)` down to its root identifier name, or null.
 * @param {ts.Expression} e
 * @returns {string | null}
 */
function rootName(e) {
	let cur = e;
	for (;;) {
		if (ts.isIdentifier(cur)) return cur.text;
		if (ts.isPropertyAccessExpression(cur) || ts.isCallExpression(cur)) {
			cur = cur.expression;
			continue;
		}
		if (ts.isNonNullExpression(cur) || ts.isParenthesizedExpression(cur)) {
			cur = cur.expression;
			continue;
		}
		return null;
	}
}

/**
 * The root test API name (`test`, `it`, `describe`, `suite`) when `e` is that identifier or a
 * chain of known modifiers over it (`it.each([..])`, `test.skipIf(c)`, `describe.only`); null for
 * anything else, including a local variable that happens to be called `it`.
 * @param {ts.Expression} e
 * @returns {string | null}
 */
function testApiRoot(e) {
	let cur = e;
	for (;;) {
		if (ts.isIdentifier(cur)) return TEST_ROOTS.has(cur.text) ? cur.text : null;
		if (ts.isPropertyAccessExpression(cur)) {
			if (!TEST_MODIFIERS.has(cur.name.text)) return null;
			cur = cur.expression;
			continue;
		}
		if (ts.isCallExpression(cur)) {
			cur = cur.expression;
			continue;
		}
		return null;
	}
}

/**
 * `timeout`-style property of an object literal: value node (or null when absent).
 * Shorthand `{ timeout }` yields the identifier, which `numberOf` treats as non-literal.
 * @param {ts.ObjectLiteralExpression} obj
 * @param {string} name
 * @returns {{ prop: ts.ObjectLiteralElementLike; value: ts.Node } | null}
 */
function propOf(obj, name) {
	for (const p of obj.properties) {
		if (ts.isPropertyAssignment(p) && propName(p) === name)
			return { prop: p, value: p.initializer };
		if (ts.isShorthandPropertyAssignment(p) && p.name.text === name) {
			return { prop: p, value: p.name };
		}
	}
	return null;
}

/** @param {ts.ObjectLiteralElementLike} p */
function propName(p) {
	const n = p.name;
	if (!n) return null;
	if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
		return n.text;
	}
	return null;
}

/** @param {ts.Node} n */
const isFunction = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n);

/**
 * The statement that owns `n`: the ancestor whose parent is the SourceFile, a Block or a
 * ModuleBlock. Leading comments on that statement are the annotation site.
 * @param {ts.Node} n
 */
function statementOf(n) {
	let cur = n;
	while (
		cur.parent &&
		!ts.isSourceFile(cur.parent) &&
		!ts.isBlock(cur.parent) &&
		!ts.isModuleBlock(cur.parent)
	) {
		cur = cur.parent;
	}
	return cur;
}

/**
 * The VariableStatement declaring identifier `name` at any depth of `sf`, or null.
 * @param {ts.SourceFile} sf
 * @param {string} name
 * @returns {ts.Node | null}
 */
function declarationOf(sf, name) {
	/** @type {ts.Node | null} */
	let found = null;
	const visit = (/** @type {ts.Node} */ n) => {
		if (found) return;
		if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) {
			found = statementOf(n);
			return;
		}
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return found;
}

/**
 * Joined text of every comment in the leading trivia of `n`, plus a trailing comment on its line.
 * @param {string} text
 * @param {ts.Node} n
 */
function commentsAround(text, n) {
	const leading = ts.getLeadingCommentRanges(text, n.getFullStart()) ?? [];
	const trailing = ts.getTrailingCommentRanges(text, n.getEnd()) ?? [];
	return [...leading, ...trailing].map((r) => text.slice(r.pos, r.end)).join('\n');
}

/**
 * True when a "measured <n> <unit>" + "cause" comment sits above the carrying property, above the
 * enclosing statement, or above the const declaration of an identifier used as the value.
 * @param {ts.SourceFile} sf
 * @param {string} text
 * @param {ts.Node} site the call or property the raise lives in
 * @param {ts.Node | null} prop the PropertyAssignment carrying the timeout, if any
 * @param {ts.Node | null} value the timeout value node, if any
 */
function hasAnnotation(sf, text, site, prop, value) {
	/** @type {ts.Node[]} */
	const candidates = [statementOf(site)];
	if (prop) candidates.push(prop);
	if (value && ts.isIdentifier(value)) {
		const decl = declarationOf(sf, value.text);
		if (decl) candidates.push(decl);
	}
	return candidates.some((n) => {
		const c = commentsAround(text, n);
		return MEASURED.test(c) && CAUSE.test(c);
	});
}

/** @param {ts.SourceFile} sf @param {(n: ts.Node) => void} fn */
function walk(sf, fn) {
	const visit = (/** @type {ts.Node} */ n) => {
		fn(n);
		ts.forEachChild(n, visit);
	};
	visit(sf);
}

// ---------------------------------------------------------------------------------------------
// Rule 1: elapsed time

/**
 * `performance.now()`, `process.hrtime()`, `process.hrtime.bigint()` and any subtraction with a
 * `Date.now()` operand. `Date.now()` used as a plain value is not elapsed time.
 * @param {string} path
 * @param {string} text
 * @returns {Finding[]}
 */
export function elapsedTimeFindings(path, text) {
	const sf = parse(path, text);
	/** @type {Finding[]} */
	const out = [];
	const isDateNow = (/** @type {ts.Node} */ n) =>
		ts.isCallExpression(n) && n.expression.getText(sf) === 'Date.now';
	walk(sf, (n) => {
		if (ts.isCallExpression(n)) {
			const callee = n.expression.getText(sf);
			if (ELAPSED_CALLEES.has(callee)) {
				out.push({ path, line: lineOf(sf, n), rule: 'elapsed-time', detail: `${callee}()` });
			}
		} else if (
			ts.isBinaryExpression(n) &&
			n.operatorToken.kind === ts.SyntaxKind.MinusToken &&
			(isDateNow(n.left) || isDateNow(n.right))
		) {
			out.push({
				path,
				line: lineOf(sf, n),
				rule: 'elapsed-time',
				detail: 'Date.now() subtraction'
			});
		}
	});
	return out;
}

// ---------------------------------------------------------------------------------------------
// Rule 2 + 3 (Vitest): raised timeouts, lane placement and annotation

/**
 * @typedef {{ site: ts.Node; prop: ts.Node | null; value: ts.Node | null; raised: boolean; detail: string }} RaiseSite
 */

/**
 * Every Vitest timeout site in `sf` with its raised verdict for `lane`.
 * @param {ts.SourceFile} sf
 * @param {Lane} lane
 * @returns {RaiseSite[]}
 */
function vitestRaiseSites(sf, lane) {
	const testMax = lane.browser ? DEFAULTS.browserTest : DEFAULTS.nodeTest;
	const hookMax = lane.browser ? DEFAULTS.browserHook : DEFAULTS.nodeHook;
	/** @type {RaiseSite[]} */
	const sites = [];
	const push = (
		/** @type {ts.Node} */ site,
		/** @type {ts.Node | null} */ prop,
		/** @type {ts.Node | null} */ value,
		/** @type {number} */ max,
		/** @type {string} */ label
	) => {
		const v = numberOf(value ?? undefined);
		const shown = value ? valueText(value, sf) : 'unspecified';
		sites.push({
			site,
			prop,
			value,
			raised: isRaised(v, max),
			detail: `${label} ${shown} > ${max}`
		});
	};
	walk(sf, (n) => {
		if (!ts.isCallExpression(n)) return;
		const callee = n.expression;
		const calleeText = callee.getText(sf);
		const args = n.arguments;

		if (calleeText === 'vi.setConfig') {
			sites.push({ site: n, prop: null, value: null, raised: true, detail: 'vi.setConfig()' });
			return;
		}
		if (WAITS.has(calleeText)) {
			const second = args[1];
			if (second && ts.isObjectLiteralExpression(second)) {
				const t = propOf(second, 'timeout');
				if (t) push(n, t.prop, t.value, DEFAULTS.wait, `${calleeText} timeout`);
			} else if (second && calleeText.startsWith('vi.')) {
				push(n, null, second, DEFAULTS.wait, `${calleeText} timeout`);
			}
			return;
		}
		if (ts.isIdentifier(callee) && HOOKS.has(callee.text)) {
			const fnIndex = args.findIndex(isFunction);
			const trailing = fnIndex >= 0 ? args[fnIndex + 1] : undefined;
			if (trailing && !ts.isObjectLiteralExpression(trailing)) {
				push(n, null, trailing, hookMax, `${callee.text} trailing timeout`);
			}
			return;
		}
		const testRoot = testApiRoot(callee);
		if (testRoot !== null) {
			const fnIndex = args.findIndex(isFunction);
			args.forEach((a, i) => {
				if (ts.isObjectLiteralExpression(a)) {
					const t = propOf(a, 'timeout');
					if (t) push(n, t.prop, t.value, testMax, `${testRoot} option timeout`);
				} else if (fnIndex >= 0 && i > fnIndex && !isFunction(a)) {
					push(n, null, a, testMax, `${testRoot} trailing timeout`);
				}
			});
		}
	});
	return sites;
}

/**
 * Raised Vitest timeouts. Outside the serial lane every raise is a finding
 * ('raised-timeout-outside-serial'); inside it, only raises without the measured+cause comment
 * ('unannotated-raise').
 * @param {string} path
 * @param {string} text
 * @param {Lane} lane
 * @returns {Finding[]}
 */
export function vitestTimeoutFindings(path, text, lane) {
	const sf = parse(path, text);
	/** @type {Finding[]} */
	const out = [];
	for (const s of vitestRaiseSites(sf, lane)) {
		if (!s.raised) continue;
		if (!lane.serial) {
			out.push({
				path,
				line: lineOf(sf, s.site),
				rule: 'raised-timeout-outside-serial',
				detail: s.detail
			});
		} else if (!hasAnnotation(sf, text, s.site, s.prop, s.value)) {
			out.push({
				path,
				line: lineOf(sf, s.site),
				rule: 'unannotated-raise',
				detail: `${s.detail} without measured+cause comment`
			});
		}
	}
	return out;
}

// ---------------------------------------------------------------------------------------------
// Rule 3 (Playwright): every raise needs the annotation

/**
 * Playwright raises: `test.setTimeout(> 30 s)`, `describe.configure({ timeout > 30 s })`,
 * `test.slow()` (always), and any other call's `{ timeout > 5 s }` option.
 * @param {string} path
 * @param {string} text
 * @returns {Finding[]}
 */
export function playwrightTimeoutFindings(path, text) {
	const sf = parse(path, text);
	/** @type {Finding[]} */
	const out = [];
	const report = (
		/** @type {ts.Node} */ site,
		/** @type {ts.Node | null} */ prop,
		/** @type {ts.Node | null} */ value,
		/** @type {string} */ detail
	) => {
		if (hasAnnotation(sf, text, site, prop, value)) return;
		out.push({
			path,
			line: lineOf(sf, site),
			rule: 'unannotated-raise',
			detail: `${detail} without measured+cause comment`
		});
	};
	walk(sf, (n) => {
		if (!ts.isCallExpression(n)) return;
		const callee = n.expression;
		const calleeText = callee.getText(sf);
		const root = rootName(callee);
		const args = n.arguments;

		if (root === 'test' && calleeText.endsWith('.setTimeout')) {
			const v = args[0];
			const num = numberOf(v);
			if (v && isRaised(num, DEFAULTS.pwTest)) {
				report(n, null, v, `test.setTimeout ${valueText(v, sf)} > ${DEFAULTS.pwTest}`);
			}
			return;
		}
		if (calleeText.endsWith('describe.configure')) {
			const opts = args[0];
			if (opts && ts.isObjectLiteralExpression(opts)) {
				const t = propOf(opts, 'timeout');
				if (t && isRaised(numberOf(t.value), DEFAULTS.pwTest)) {
					report(
						n,
						t.prop,
						t.value,
						`describe.configure timeout ${valueText(t.value, sf)} > ${DEFAULTS.pwTest}`
					);
				}
			}
			return;
		}
		if (root === 'test' && calleeText.endsWith('.slow')) {
			report(n, null, null, 'test.slow()');
			return;
		}
		for (const a of args) {
			if (!ts.isObjectLiteralExpression(a)) continue;
			const t = propOf(a, 'timeout');
			if (t && isRaised(numberOf(t.value), DEFAULTS.pwExpect)) {
				report(
					n,
					t.prop,
					t.value,
					`${calleeText} timeout ${valueText(t.value, sf)} > ${DEFAULTS.pwExpect}`
				);
			}
		}
	});
	return out;
}

// ---------------------------------------------------------------------------------------------
// Rule 3 (configs)

/**
 * Raised timeouts in Vitest and Playwright configs without the annotation.
 * Vitest: `testTimeout` (> 5000, or > 15000 when the path contains 'browser'), `hookTimeout`
 * (> 10000 / > 30000), `teardownTimeout` (> 10000). Playwright: `timeout` of the `defineConfig`
 * object or a `projects` entry (> 30 s), `expect.timeout` (> 5 s); `webServer` and `globalTimeout`
 * are ignored.
 * @param {string} path
 * @param {string} text
 * @returns {Finding[]}
 */
export function configTimeoutFindings(path, text) {
	const kind = fileKind(path);
	if (kind !== 'vitest-config' && kind !== 'playwright-config') return [];
	const sf = parse(path, text);
	const browser = path.includes('browser');
	/** @type {Finding[]} */
	const out = [];
	const report = (/** @type {ts.PropertyAssignment} */ p, /** @type {number} */ max) => {
		if (!isRaised(numberOf(p.initializer), max)) return;
		if (hasAnnotation(sf, text, p, p, p.initializer)) return;
		out.push({
			path,
			line: lineOf(sf, p),
			rule: 'unannotated-raise',
			detail: `${propName(p)} ${valueText(p.initializer, sf)} > ${max} without measured+cause comment`
		});
	};
	walk(sf, (n) => {
		if (!ts.isPropertyAssignment(n)) return;
		const name = propName(n);
		if (kind === 'vitest-config') {
			if (name === 'testTimeout') report(n, browser ? DEFAULTS.browserTest : DEFAULTS.nodeTest);
			else if (name === 'hookTimeout')
				report(n, browser ? DEFAULTS.browserHook : DEFAULTS.nodeHook);
			else if (name === 'teardownTimeout') report(n, DEFAULTS.nodeHook);
			return;
		}
		if (name !== 'timeout') return;
		const obj = n.parent;
		if (!ts.isObjectLiteralExpression(obj)) return;
		const owner = obj.parent;
		if (ts.isPropertyAssignment(owner) && propName(owner) === 'expect') {
			report(n, DEFAULTS.pwExpect);
		} else if (isConfigRoot(owner, obj) || isProjectEntry(owner)) {
			report(n, DEFAULTS.pwTest);
		}
	});
	return out;
}

/** The object is the first argument of `defineConfig(...)` or the `export default` value. */
function isConfigRoot(/** @type {ts.Node} */ owner, /** @type {ts.Node} */ obj) {
	if (ts.isExportAssignment(owner)) return true;
	return (
		ts.isCallExpression(owner) &&
		rootName(owner.expression) === 'defineConfig' &&
		owner.arguments[0] === obj
	);
}

/** The object is an element of a `projects: [...]` array. */
function isProjectEntry(/** @type {ts.Node} */ owner) {
	return (
		ts.isArrayLiteralExpression(owner) &&
		ts.isPropertyAssignment(owner.parent) &&
		propName(owner.parent) === 'projects'
	);
}

// ---------------------------------------------------------------------------------------------
// Rule 4: retries

/**
 * Retries anywhere: Vitest `retry` options and config keys, Playwright `describe.configure({
 * retries })`, Playwright config `retries` that differ from PINNED_RETRIES, and the retry CLI
 * flags (RETRY_FLAG) in package.json scripts, workflow lines and scripts/*.mjs string literals.
 * @param {string} path
 * @param {string} text
 * @returns {Finding[]}
 */
export function retryFindings(path, text) {
	const kind = fileKind(path);
	/** @type {Finding[]} */
	const out = [];
	const at = (/** @type {number} */ line, /** @type {string} */ detail) =>
		out.push({ path, line, rule: 'retry', detail });

	if (kind === 'package-json') {
		return packageJsonRetries(path, text);
	}
	if (kind === 'workflow') {
		// Plain text, one finding per non-comment line that carries the flag.
		text.split(/\r?\n/).forEach((l, i) => {
			if (!/^\s*#/.test(l) && RETRY_FLAG.test(l)) at(i + 1, l.trim());
		});
		return out;
	}
	if (kind === 'script-mjs') {
		// String literals only (parsed as JS), so a comment that mentions the flag is not a finding.
		const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		walk(sf, (n) => {
			if (
				(ts.isStringLiteral(n) ||
					ts.isNoSubstitutionTemplateLiteral(n) ||
					ts.isTemplateLiteralToken(n)) &&
				RETRY_FLAG.test(n.text)
			) {
				at(lineOf(sf, n), `string ${JSON.stringify(n.text)}`);
			}
		});
		return out;
	}
	if (kind === null) return out;

	const sf = parse(path, text);
	walk(sf, (n) => {
		if (kind === 'vitest-config') {
			if (ts.isPropertyAssignment(n) && propName(n) === 'retry') {
				at(lineOf(sf, n), `retry: ${n.initializer.getText(sf)} in Vitest config`);
			}
			return;
		}
		if (kind === 'playwright-config') {
			if (ts.isPropertyAssignment(n) && propName(n) === 'retries') {
				const pinned = /** @type {Record<string, string>} */ (PINNED_RETRIES)[path] ?? '0';
				const actual = n.initializer.getText(sf);
				if (actual !== pinned) at(lineOf(sf, n), `retries: ${actual} (pinned: ${pinned})`);
			}
			return;
		}
		if (!ts.isCallExpression(n)) return;
		const calleeText = n.expression.getText(sf);
		if (kind === 'playwright') {
			if (calleeText.endsWith('describe.configure')) {
				const opts = n.arguments[0];
				if (opts && ts.isObjectLiteralExpression(opts) && propOf(opts, 'retries')) {
					at(lineOf(sf, n), 'describe.configure({ retries })');
				}
			}
			return;
		}
		// vitest-test
		const root = testApiRoot(n.expression);
		if (root === null) return;
		for (const a of n.arguments) {
			if (ts.isObjectLiteralExpression(a) && propOf(a, 'retry')) {
				at(lineOf(sf, n), `${root} option retry`);
			}
		}
	});
	return out;
}

/**
 * The retry CLI flag (RETRY_FLAG) in any package.json script value. Falls back to a line scan when
 * the file does not parse as JSON.
 * @param {string} path
 * @param {string} text
 * @returns {Finding[]}
 */
function packageJsonRetries(path, text) {
	/** @type {Finding[]} */
	const out = [];
	const lines = text.split(/\r?\n/);
	/** @type {Record<string, unknown>} */
	let scripts;
	try {
		const parsed = JSON.parse(text);
		scripts = parsed && typeof parsed.scripts === 'object' ? parsed.scripts : {};
	} catch {
		lines.forEach((l, i) => {
			if (RETRY_FLAG.test(l)) out.push({ path, line: i + 1, rule: 'retry', detail: l.trim() });
		});
		return out;
	}
	for (const [name, cmd] of Object.entries(scripts)) {
		if (typeof cmd !== 'string' || !RETRY_FLAG.test(cmd)) continue;
		const idx = lines.findIndex((l) => l.includes(`"${name}"`) && RETRY_FLAG.test(l));
		out.push({
			path,
			line: idx >= 0 ? idx + 1 : 1,
			rule: 'retry',
			detail: `script "${name}": ${cmd}`
		});
	}
	return out;
}

// ---------------------------------------------------------------------------------------------
// Rule 4b: retrying assertions

/**
 * `.toPass()` calls beyond the allowlisted count for `path` (default 0). One finding per excess
 * call, at that call's line.
 * @param {string} path
 * @param {string} text
 * @returns {Finding[]}
 */
export function toPassFindings(path, text) {
	const sf = parse(path, text);
	/** @type {ts.CallExpression[]} */
	const calls = [];
	walk(sf, (n) => {
		if (
			ts.isCallExpression(n) &&
			ts.isPropertyAccessExpression(n.expression) &&
			n.expression.name.text === 'toPass'
		) {
			calls.push(n);
		}
	});
	const allowed = /** @type {Record<string, number>} */ (TO_PASS_ALLOWLIST)[path] ?? 0;
	// Report the `.toPass` token, not the start of a multi-line `expect(async () => { ... })` chain.
	return calls.slice(allowed).map((c) => ({
		path,
		line: lineOf(sf, /** @type {ts.PropertyAccessExpression} */ (c.expression).name),
		rule: /** @type {const} */ ('to-pass'),
		detail: `.toPass() call ${calls.indexOf(c) + 1} of ${calls.length}, allowlist ${allowed}`
	}));
}

// ---------------------------------------------------------------------------------------------
// Router

/**
 * Runs every rule that applies to `path`, by `fileKind`. Vitest tests in the serial lane skip the
 * elapsed-time rule (that is where timing assertions belong).
 * @param {string} path
 * @param {string} text
 * @param {SerialManifest} serial
 * @returns {Finding[]}
 */
export function scanFile(path, text, serial) {
	switch (fileKind(path)) {
		case 'vitest-test': {
			const lane = /** @type {Lane} */ (laneOf(path, serial));
			return [
				...(lane.serial ? [] : elapsedTimeFindings(path, text)),
				...vitestTimeoutFindings(path, text, lane),
				...retryFindings(path, text)
			];
		}
		case 'playwright':
			return [
				...playwrightTimeoutFindings(path, text),
				...retryFindings(path, text),
				...toPassFindings(path, text)
			];
		case 'vitest-config':
		case 'playwright-config':
			return [...configTimeoutFindings(path, text), ...retryFindings(path, text)];
		case 'package-json':
		case 'workflow':
		case 'script-mjs':
			return retryFindings(path, text);
		default:
			return [];
	}
}
