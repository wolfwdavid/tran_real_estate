// SMOKE-02 service-worker contract against a served build: the worker registers from the page's own
// origin with scope = base, its single cache is keyed by this build's SHA, and everything it
// precaches is a same-origin path under the base with no dotfile segment. Read-only: GETs only.
import { test, expect, smoke, installedPrecache } from './fixtures';

const basePath = new URL(smoke.baseUrl).pathname;

test('the worker registers from this origin with scope = base', async ({ page }) => {
	const { scope, script, origin } = await installedPrecache(page);
	expect(scope).toBe(smoke.baseUrl);
	expect(new URL(script).origin).toBe(origin);
	expect(new URL(script).pathname).toBe(basePath + 'service-worker.js');
});

test('precache is one tran-shell-<version> cache of same-origin GETs under the base, no dotfiles', async ({
	page
}) => {
	const { keys, urls, origin } = await installedPrecache(page);
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

test('manifest.webmanifest is served as a named web app manifest', async ({ request }) => {
	const res = await request.get('manifest.webmanifest');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('application/manifest+json');
	const manifest = JSON.parse(await res.text()) as { name?: unknown };
	expect(typeof manifest.name).toBe('string');
});
