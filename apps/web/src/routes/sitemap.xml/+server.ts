import { sitemapPaths, sitemapXml } from '#lib/seo/sitemap.ts';
import { SITE_URL } from '#lib/site.ts';

export const prerender = true;

// (app) and (print) pages are noindex and never listed; classify every new page by its route group.
const PATHS = sitemapPaths(
	Object.keys(import.meta.glob('/src/routes/(marketing)/**/+page.svelte'))
);

export function GET() {
	return new Response(sitemapXml(SITE_URL, PATHS), {
		headers: { 'content-type': 'application/xml' }
	});
}
