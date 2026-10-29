// SMOKE-02 hashed-asset contract: every /_app/immutable/ file the service worker precaches answers
// 200 from the served origin. A partial or interrupted deploy shows up here as a 404 before any
// visitor's worker fails its install. Read-only: GETs only.
import { test, expect, type Page } from './fixtures';

const CHUNK = 25;

/** The precache URLs, read from inside the page once the worker has installed. */
const swCache = (page: Page) =>
	page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		const keys = await caches.keys();
		const urls =
			keys.length === 1 ? (await (await caches.open(keys[0])).keys()).map((r) => r.url) : [];
		return { keys, urls };
	});

test('every hashed asset in the precache answers 200', async ({ page, request }) => {
	await page.goto('');
	await expect
		.poll(async () => {
			const { keys, urls } = await swCache(page);
			return keys.length === 1 && urls.length > 0;
		})
		.toBe(true);
	const hashed = (await swCache(page)).urls.filter((u) => u.includes('/_app/immutable/'));
	expect(hashed.length).toBeGreaterThan(50); // non-vacuity: the build ships hundreds of chunks

	const failures: string[] = [];
	for (let i = 0; i < hashed.length; i += CHUNK) {
		const statuses = await Promise.all(
			hashed.slice(i, i + CHUNK).map(async (u) => [(await request.get(u)).status(), u] as const)
		);
		for (const [status, u] of statuses) if (status !== 200) failures.push(`${status} ${u}`);
	}
	expect(failures).toEqual([]);
});
