// SMOKE-02 SEO contracts over HTTP: sitemap, robots, manifest and share tags, all on the build's
// site URL (smoke.siteUrl), never a hard-coded origin. The configured target serves pages from
// 127.0.0.1 whose absolute URLs carry its own test origin, which is the HTTP-level LIVE-08 proof.
import { test, expect, smoke } from './fixtures';
import { LEGAL_ROUTES, MARKETING_ROUTES } from '../e2e/routes';

const site = smoke.siteUrl;
const INDEXABLE = [...MARKETING_ROUTES, ...LEGAL_ROUTES];

test('sitemap lists exactly the indexable URLs on the site URL', async ({ request }) => {
	const res = await request.get('sitemap.xml');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('xml');
	const locs = [...(await res.text()).matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
	expect(new Set(locs)).toEqual(new Set(INDEXABLE.map((r) => site + r)));
	expect(locs.length).toBe(14);
});

test('robots.txt points at the sitemap', async ({ request }) => {
	const res = await request.get('robots.txt');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('text/plain');
	expect(await res.text()).toContain(`Sitemap: ${site}sitemap.xml`);
});

test('manifest.webmanifest answers 200', async ({ request }) => {
	const res = await request.get('manifest.webmanifest');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('application/manifest+json');
});

// Share tags are read from the prerendered HTML (one GET per route, no page load): crawlers read
// that HTML, and a page load would also fetch every script and style against the CDN's rate limit.
/** The attributes of every `<name ...>` tag in the HTML, in any attribute order. */
const tags = (html: string, name: string): Record<string, string>[] =>
	[...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((tag) =>
		Object.fromEntries([...tag[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]))
	);
/** The `content` of every meta tag whose property or name passes the predicate. */
const metaContents = (html: string, wanted: (key: string) => boolean): string[] =>
	tags(html, 'meta')
		.filter((m) => wanted(m.property ?? '') || wanted(m.name ?? ''))
		.map((m) => m.content ?? '');

for (const route of INDEXABLE) {
	test(`share tags on /${route}`, async ({ request }) => {
		const res = await request.get(route);
		expect(res.status()).toBe(200);
		const html = await res.text();
		expect(metaContents(html, (k) => k === 'og:image')).toHaveLength(1);
		const canonicals = tags(html, 'link').filter((l) => l.rel === 'canonical');
		expect(canonicals.map((l) => l.href)).toEqual([site + route]);
		expect(metaContents(html, (k) => k === 'og:url')).toEqual([site + route]);
		const absolute = metaContents(
			html,
			(k) => k.startsWith('og:') || k.startsWith('twitter:')
		).filter((c) => c.startsWith('http'));
		expect(absolute.length).toBeGreaterThan(0);
		expect(absolute.filter((c) => !c.startsWith(site))).toEqual([]);
	});
}

test('the landing og:image answers image/png', async ({ request }) => {
	const [content = ''] = metaContents(
		await (await request.get('')).text(),
		(k) => k === 'og:image'
	);
	expect(content.startsWith(site)).toBe(true);
	// The card is absolute on the site URL; map its path (below the site's base) onto the served base.
	const rel = new URL(content).pathname.slice(new URL(site).pathname.length);
	const res = await request.get(new URL(rel, smoke.baseUrl).href);
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toContain('image/png');
});
