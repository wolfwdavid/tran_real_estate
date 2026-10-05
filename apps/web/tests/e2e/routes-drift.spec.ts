import { test, expect } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROUTES } from './routes';

// RESEARCH Pitfall 13: the routing, CSP and axe specs are only as strong as the route list they
// iterate. This guard compares the pages the build actually emitted (every index.html) against
// the shared ROUTES list, per Playwright project, so a page added to or removed from the app
// without updating routes.ts fails E2E instead of silently going untested.

/** Pages in `built` that routes.ts does not list, and listed routes the build did not emit. */
function diffRoutes(
	built: readonly string[],
	listed: readonly string[]
): { unlisted: string[]; missing: string[] } {
	return {
		unlisted: built.filter((r) => !listed.includes(r)).sort(),
		missing: listed.filter((r) => !built.includes(r)).sort()
	};
}

/** Route paths ('' for the home page, 'x/y/' otherwise) for every index.html under `dir`. */
function builtRoutes(dir: string): string[] {
	return readdirSync(dir, { recursive: true, encoding: 'utf8' })
		.map((f) => f.replace(/\\/g, '/'))
		.filter((f) => f === 'index.html' || f.endsWith('/index.html'))
		.map((f) => f.slice(0, -'index.html'.length));
}

test('the built pages equal the shared ROUTES list', () => {
	const testInfo = test.info();
	const dir = fileURLToPath(
		new URL(testInfo.project.name === 'sub' ? '../../build-sub' : '../../build', import.meta.url)
	);
	expect(existsSync(dir), dir).toBe(true);
	const built = builtRoutes(dir);
	// Non-vacuity: an empty or half-written build must not compare equal to anything useful.
	expect(built.length).toBeGreaterThanOrEqual(13);
	expect(diffRoutes(built, ROUTES), `build folder ${dir}`).toEqual({ unlisted: [], missing: [] });
	expect([...built].sort()).toEqual([...ROUTES].sort());
});

test('the drift check reports a page missing from ROUTES (non-vacuity)', () => {
	const built = [...ROUTES, 'unlisted/'];
	expect(diffRoutes(built, ROUTES)).toEqual({ unlisted: ['unlisted/'], missing: [] });
	expect(diffRoutes(ROUTES.slice(1), ROUTES).missing).toEqual([ROUTES[0]]);
});
