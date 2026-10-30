// SMOKE-02 hashed-asset contract: every /_app/immutable/ file the service worker precaches answers
// 200 from the served origin. A partial or interrupted deploy shows up here as a 404 before any
// visitor's worker fails its install. Read-only: GETs only.
import { test, expect, installedPrecache } from './fixtures';

const CHUNK = 25;

test('every hashed asset in the precache answers 200', async ({ page, request }) => {
	const { urls } = await installedPrecache(page);
	const hashed = urls.filter((u) => u.includes('/_app/immutable/'));
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
