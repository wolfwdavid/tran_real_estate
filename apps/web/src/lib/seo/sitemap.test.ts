import { describe, expect, it } from 'vitest';
import { robotsTxt, sitemapPaths, sitemapXml } from './sitemap';

const SUB = 'https://wolfwdavid.github.io/tran_real_estate';
const ROOT = 'https://wolfwdavid.github.io';

describe('sitemapPaths', () => {
	it('keeps static (marketing) pages, sorted, and drops dynamic routes', () => {
		expect(
			sitemapPaths([
				'/src/routes/(marketing)/+page.svelte',
				'/src/routes/(marketing)/for-renters/+page.svelte',
				'/src/routes/(marketing)/tools/cap-rate/+page.svelte',
				'/src/routes/(marketing)/legal/privacy/+page.svelte',
				'/src/routes/(marketing)/x/[id]/+page.svelte'
			])
		).toEqual(['/', '/for-renters/', '/legal/privacy/', '/tools/cap-rate/']);
	});

	it('ignores other route groups and strips nested groups', () => {
		expect(
			sitemapPaths([
				'/src/routes/(app)/settings/+page.svelte',
				'/src/routes/(print)/print/memo/+page.svelte',
				'/src/routes/(marketing)/(inner)/feedback/+page.svelte'
			])
		).toEqual(['/feedback/']);
	});

	it('de-duplicates paths', () => {
		expect(
			sitemapPaths([
				'/src/routes/(marketing)/tools/+page.svelte',
				'/src/routes/(marketing)/(a)/tools/+page.svelte'
			])
		).toEqual(['/tools/']);
	});
});

describe('sitemapXml', () => {
	it('writes one absolute loc per path and no lastmod', () => {
		const xml = sitemapXml(SUB, ['/', '/tools/']);
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(xml.match(/<url><loc>/g)).toHaveLength(2);
		expect(xml).toContain(`<url><loc>${SUB}/</loc></url>`);
		expect(xml).toContain(`<url><loc>${SUB}/tools/</loc></url>`);
		expect(xml).not.toContain('lastmod');
		expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
	});

	it('tolerates a trailing slash on the site URL and escapes XML', () => {
		const xml = sitemapXml(`${ROOT}/`, ['/a&b/']);
		expect(xml).toContain(`<loc>${ROOT}/a&amp;b/</loc>`);
	});
});

describe('robotsTxt', () => {
	it('disallows print and the inquiry page under the base path', () => {
		expect(robotsTxt(SUB)).toBe(
			'User-agent: *\nAllow: /\nDisallow: /tran_real_estate/print/\nDisallow: /tran_real_estate/agent/inquire/\nSitemap: https://wolfwdavid.github.io/tran_real_estate/sitemap.xml\n'
		);
	});

	it('uses root paths on the root build', () => {
		expect(robotsTxt(ROOT)).toBe(
			'User-agent: *\nAllow: /\nDisallow: /print/\nDisallow: /agent/inquire/\nSitemap: https://wolfwdavid.github.io/sitemap.xml\n'
		);
	});
});
