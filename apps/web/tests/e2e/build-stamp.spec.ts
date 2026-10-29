import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { targetEnv } from '../../../../scripts/lib/build-targets.mjs';

// LIVE-04: every build is stamped with the commit it was made from (kit.version.name), so
// /_app/version.json identifies a deploy and the service-worker cache key follows it. CI sets
// GITHUB_SHA (the commit it built); locally the expected stamp is git HEAD, so a stale build dir
// fails here with a rebuild hint instead of passing on yesterday's output.

const expected =
	process.env.GITHUB_SHA ||
	(spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout ?? '').trim();

const buildDir = (project: string) =>
	join(import.meta.dirname, '..', '..', targetEnv(project).BUILD_DIR);

test('the expected stamp is a full commit SHA', () => {
	expect(expected).toMatch(/^[0-9a-f]{40}$/);
});

test('the build directory carries the commit stamp', () => {
	const project = test.info().project.name;
	const file = join(buildDir(project), '_app', 'version.json');
	const { version } = JSON.parse(readFileSync(file, 'utf8')) as { version: string };
	expect(version, `stale build: rebuild with pnpm build:${project}`).toBe(expected);
});

test('the served version.json equals the build stamp', async ({ request }) => {
	const res = await request.get('_app/version.json');
	expect(res.status()).toBe(200);
	expect(((await res.json()) as { version: string }).version).toBe(expected);
});

test('the service-worker cache key is tran-shell-<sha>', async ({ page }) => {
	await page.goto('');
	await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
	await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(['tran-shell-' + expected]);
});
