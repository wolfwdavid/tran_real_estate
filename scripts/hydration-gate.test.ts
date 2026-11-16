// Sweep guard (phase 16-13): `html` losing `hidden` is NOT a hydration signal, because frame-guard.js
// removes it at parse time, long before Svelte attaches handlers. A test that interacts after only that
// wait loses its first click or file-change under load (agent-csv.spec.ts:91 failed 33 s under CPU
// pressure). Interacting tests gate on expectHydrated() (nav[data-hydrated], helpers/hydration.ts).
// This sweep allows the hidden check only where it is the point: the frame guard / CSP / PWA / framing
// checks, or pages with no SiteHeader (print/*, agent/inquire/) where nav[data-hydrated] never exists.
// Planted cases prove the scan reports a new use and a stale allowlist entry (style of kit3-migration.test.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const TESTS = join(ROOT, 'apps/web/tests');
const HIDDEN_WAIT = /not\s*\.toHaveAttribute\(\s*['"]hidden['"]/g;

/** Exact repo-relative path -> exact number of `not.toHaveAttribute('hidden')` uses kept on purpose. */
const ALLOWLIST: Readonly<Record<string, number>> = Object.freeze({
	// Axe/ROUTES loops that include header-less print/* and agent/inquire/ pages (CHROME_ROUTES also wait on the nav).
	'apps/web/tests/e2e/a11y-keyed.spec.ts': 1,
	'apps/web/tests/e2e/a11y.spec.ts': 1,
	// settle(page, false): only the public inquiry page, which has no SiteHeader and never interacts.
	'apps/web/tests/e2e/agent-a11y.spec.ts': 1,
	'apps/web/tests/e2e/agent-inquire.spec.ts': 1,
	// Frame guard must run under the CSP (script-src 'self' check) and the framing/PWA checks.
	'apps/web/tests/e2e/csp.spec.ts': 1,
	'apps/web/tests/e2e/framing.spec.ts': 1,
	'apps/web/tests/e2e/pwa.spec.ts': 1,
	// print/* routes have no SiteHeader.
	'apps/web/tests/e2e/disclaimers.spec.ts': 1,
	'apps/web/tests/e2e/seo.spec.ts': 1,
	'apps/web/tests/e2e/studio-keyless.spec.ts': 1,
	'apps/web/tests/e2e/studio-shell.spec.ts': 1
});

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? walk(join(dir, e.name)) : /\.(ts|js)$/.test(e.name) ? [join(dir, e.name)] : []
	);
}

/** Problems for `counts` (repo-relative path -> uses) measured against `allow`. */
export function problems(counts: Record<string, number>, allow: Readonly<Record<string, number>>) {
	const out: string[] = [];
	for (const [path, n] of Object.entries(counts)) {
		if (n !== (allow[path] ?? 0)) out.push(`${path}: ${n} uses, allowlist has ${allow[path] ?? 0}`);
	}
	for (const path of Object.keys(allow)) {
		if (!(path in counts)) out.push(`${path}: allowlisted but has no use (remove it)`);
	}
	return out;
}

function measure(): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const file of walk(TESTS)) {
		const n = readFileSync(file, 'utf8').match(HIDDEN_WAIT)?.length ?? 0;
		if (n > 0) counts[relative(ROOT, file).split('\\').join('/')] = n;
	}
	return counts;
}

describe('html-not-hidden is not a hydration gate', () => {
	test('every use under apps/web/tests is on the allowlist (and the allowlist has no stale entry)', () => {
		const counts = measure();
		expect(Object.keys(counts).length).toBeGreaterThanOrEqual(8); // non-vacuity
		expect(problems(counts, ALLOWLIST)).toEqual([]);
	});

	test('planted: a new use in a spec outside the allowlist is reported', () => {
		const planted = { ...measure(), 'apps/web/tests/e2e/planted.spec.ts': 1 };
		expect(problems(planted, ALLOWLIST)).toEqual([
			'apps/web/tests/e2e/planted.spec.ts: 1 uses, allowlist has 0'
		]);
	});

	test('planted: a second use in an allowlisted file and a stale entry are reported', () => {
		const counts = measure();
		const doubled = { ...counts, 'apps/web/tests/e2e/csp.spec.ts': 2 };
		expect(problems(doubled, ALLOWLIST)).toHaveLength(1);
		const fewer = { ...counts };
		delete fewer['apps/web/tests/e2e/csp.spec.ts'];
		expect(problems(fewer, ALLOWLIST)).toEqual([
			'apps/web/tests/e2e/csp.spec.ts: allowlisted but has no use (remove it)'
		]);
	});

	test('the pattern matches both quote styles and ignores the positive form', () => {
		expect("await expect(l).not.toHaveAttribute('hidden');".match(HIDDEN_WAIT)).toHaveLength(1);
		expect('await expect(l).not.toHaveAttribute("hidden");'.match(HIDDEN_WAIT)).toHaveLength(1);
		expect("await expect(l).toHaveAttribute('hidden', '');".match(HIDDEN_WAIT)).toBeNull();
	});
});
