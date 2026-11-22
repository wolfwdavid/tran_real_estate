// SMOKE-02 service-worker contract against a served build: the worker registers from the page's own
// origin with scope = base, its single cache is keyed by this build's SHA, everything it precaches
// is a same-origin path under the base with no dotfile segment, and every hashed asset in it was
// stored with status 200. One install serves all of it, because each install fetches the whole
// build from the Pages CDN, which rate-limits the runner. Read-only: GETs only.
import { test, expect, smoke, installedPrecache } from './fixtures';

const basePath = new URL(smoke.baseUrl).pathname;

// The suite default blocks the worker (playwright.smoke.config.ts); the install below needs it.
test.use({ serviceWorkers: 'allow' });

test('the worker registers at the base and precaches this build, every hashed asset with status 200', async ({
	page
}) => {
	const { scope, script, origin, keys, urls } = await installedPrecache(page);

	await test.step('the worker registers from this origin with scope = base', () => {
		expect(scope).toBe(smoke.baseUrl);
		expect(new URL(script).origin).toBe(origin);
		expect(new URL(script).pathname).toBe(basePath + 'service-worker.js');
	});

	await test.step('precache is one tran-shell-<version> cache of same-origin GETs under the base, no dotfiles', () => {
		expect(keys).toEqual(['tran-shell-' + smoke.expectVersion]);
		for (const u of urls) {
			const url = new URL(u);
			expect(url.origin, u).toBe(origin);
			expect(url.pathname.startsWith(basePath), u).toBe(true);
			expect(
				url.pathname.split('/').some((seg) => seg.startsWith('.')),
				u
			).toBe(false);
			expect(url.pathname.endsWith('/service-worker.js'), u).toBe(false);
		}
		const paths = urls.map((u) => new URL(u).pathname);
		expect(paths).toContain(`${basePath}manifest.webmanifest`);
		expect(paths).toContain(`${basePath}renter/`);
	});

	// A partial or interrupted deploy shows up here as a non-200 entry. The statuses are read from
	// the cache the install just filled (zero further requests): same-origin entries are readable,
	// and a local probe found 322 of 322 hashed entries stored with status 200.
	await test.step('every hashed asset in the precache was stored with status 200', async () => {
		const hashed = urls.filter((u) => u.includes('/_app/immutable/'));
		expect(hashed.length).toBeGreaterThan(50); // non-vacuity: the build ships hundreds of chunks
		const failures = await page.evaluate(async (list) => {
			const out: string[] = [];
			for (const u of list) {
				const status = (await caches.match(u))?.status ?? 'missing';
				if (status !== 200) out.push(`${status} ${u}`);
			}
			return out;
		}, hashed);
		expect(failures).toEqual([]);
	});
});

test('manifest.webmanifest is served as a named web app manifest', async ({ request }) => {
	const res = await request.get('manifest.webmanifest');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('application/manifest+json');
	const manifest = JSON.parse(await res.text()) as { name?: unknown };
	expect(typeof manifest.name).toBe('string');
});
