/**
 * Sitemap and robots.txt builders (GTM-03, RESEARCH Pattern 4). Pure functions: the prerendered
 * endpoints pass `SITE_URL` and the `import.meta.glob` keys of the (marketing) pages.
 * Only (marketing) pages are listed: (app), (public) and (print) pages are noindex or private.
 */

const MARKETING_PREFIX = '/src/routes/(marketing)/';

/** Canonical paths (leading and trailing slash, sorted, unique) for (marketing) page files. */
export function sitemapPaths(globKeys: readonly string[]): string[] {
	const paths = new Set<string>();
	for (const key of globKeys) {
		if (!key.startsWith(MARKETING_PREFIX) || key.includes('[')) continue;
		const rest = key
			.slice(MARKETING_PREFIX.length)
			.replace(/\+page\.svelte$/, '')
			.replace(/(^|\/)\([^)/]+\)\//g, '$1');
		const trimmed = rest.replace(/^\/+|\/+$/g, '');
		paths.add(trimmed === '' ? '/' : `/${trimmed}/`);
	}
	return [...paths].sort();
}

const xmlEscape = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const trimSlash = (siteUrl: string) => siteUrl.replace(/\/+$/, '');

/** sitemaps.org urlset with one absolute `<loc>` per path. No `<lastmod>` (it would churn every build). */
export function sitemapXml(siteUrl: string, paths: readonly string[]): string {
	const site = trimSlash(siteUrl);
	const urls = paths.map((p) => `\t<url><loc>${xmlEscape(site + p)}</loc></url>`).join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * robots.txt for the site. /print/ pages are printouts of local data, and /agent/inquire/ carries an
 * agent's access key in its query string (UI-SPEC "Sitemap and robots"), so both are disallowed.
 */
export function robotsTxt(siteUrl: string): string {
	const site = trimSlash(siteUrl);
	const base = new URL(site).pathname.replace(/\/+$/, '');
	return [
		'User-agent: *',
		'Allow: /',
		`Disallow: ${base}/print/`,
		`Disallow: ${base}/agent/inquire/`,
		`Sitemap: ${site}/sitemap.xml`,
		''
	].join('\n');
}
