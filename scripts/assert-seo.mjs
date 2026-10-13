// Independent SEO oracle over a prerendered build directory (GTM-03: discoverable via sitemap and
// share cards). Node builtins only. It re-derives every rule from the built files, never from the
// app source, so a stale sitemap, a wrong canonical, a broken share card, fabricated ratings or FAQ
// drift fails the build even when the page code "looks right".
//
// Contracts (10-09-PLAN interfaces):
//   - Indexable = every index.html page without <meta name="robots" content="noindex">; 404.html is
//     in neither list. sitemap.xml lists exactly the indexable pages as absolute URLs under siteUrl.
//   - robots.txt carries the five UI-SPEC lines (User-agent, Allow, two Disallows, Sitemap).
//   - Every indexable page has unique title/description, canonical = siteUrl + path, og:url =
//     canonical, and an og:image that is an emitted 1200x630 PNG under 200 KB at <dir>/og/<name>.png.
//   - Tool pages (tools/<slug>/index.html) carry WebApplication + FAQPage JSON-LD, no ratings or
//     reviews, and FAQ questions identical (in order) to the visible
//     <section id="questions" aria-labelledby="questions-heading"> h3 headings.
//   - No HTML file has '..' inside an absolute URL attribute or a third-party <script src>.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveBasePath } from '../apps/web/src/lib/base-path.js';
import { resolveSiteOrigin } from '../apps/web/src/lib/site-config.js';
import { targetEnv } from './lib/build-targets.mjs';

export const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_MAX_BYTES = 200 * 1024;
export const DEFAULT_MIN_URLS = 14;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TOOL_PAGE = /^tools\/[^/]+\/index\.html$/;
const ABS_DOTDOT = /(?:href|content|src)="https?:\/\/[^"]*\.\.[^"]*"/i;
const LD_JSON = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const LD_TYPE = /(?:^|\s)type\s*=\s*(["']?)application\/ld\+json\1(?=\s|\/|$)/i;

const walk = (d) =>
	readdirSync(d).flatMap((f) =>
		statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]
	);

const decode = (s) =>
	s
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/gi, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&');

const text = (html) =>
	decode(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ''))
		.replace(/\s+/g, ' ')
		.trim();

/** All `<meta>`/`<link>` tags of a page as decoded attribute maps. */
function tags(html, name) {
	const out = [];
	for (const [tag] of html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))) {
		/** @type {Record<string, string>} */
		const attrs = {};
		for (const [, k, v] of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g)) {
			attrs[k.toLowerCase()] = decode(v);
		}
		out.push(attrs);
	}
	return out;
}

const isNoindex = (metas) =>
	metas.some(
		(m) =>
			m.name?.toLowerCase() === 'robots' &&
			m.content
				?.toLowerCase()
				.split(/[\s,]+/)
				.includes('noindex')
	);

/** '/' + rel without the trailing index.html, e.g. tools/cap-rate/index.html -> /tools/cap-rate/ */
const pagePath = (rel) => '/' + rel.slice(0, -'index.html'.length);

/** PNG width/height from IHDR (bytes 16-23, big-endian); null when the buffer is not a PNG. */
function pngSize(buf) {
	if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
	return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Collects every @type in a JSON-LD value (top-level arrays and @graph included). */
function ldNodes(value) {
	if (Array.isArray(value)) return value.flatMap(ldNodes);
	if (value && typeof value === 'object') {
		return [value, ...(Array.isArray(value['@graph']) ? value['@graph'].flatMap(ldNodes) : [])];
	}
	return [];
}
const typesOf = (node) => (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]);

/** Checks the sitemap file itself; returns the list of locs (or null when absent). */
function checkSitemap(dir, siteUrl, minUrls, err) {
	const file = join(dir, 'sitemap.xml');
	if (!existsSync(file)) {
		err('sitemap.xml', 'missing');
		return null;
	}
	const xml = readFileSync(file, 'utf8');
	if (!xml.trimStart().startsWith('<?xml'))
		err('sitemap.xml', 'must start with an <?xml declaration');
	if (!xml.includes(`<urlset xmlns="${SITEMAP_NS}">`)) {
		err('sitemap.xml', `missing <urlset xmlns="${SITEMAP_NS}">`);
	}
	const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1].trim()));
	for (const loc of locs) {
		if (!loc.startsWith(siteUrl + '/')) err('sitemap.xml', `loc ${loc} is not under ${siteUrl}/`);
		if (!loc.endsWith('/')) err('sitemap.xml', `loc ${loc} must end with '/'`);
		if (loc.includes('..')) err('sitemap.xml', `loc ${loc} contains '..'`);
	}
	if (new Set(locs).size !== locs.length) err('sitemap.xml', 'duplicate loc entries');
	if (locs.length < minUrls) {
		err('sitemap.xml', `${locs.length} URLs, expected at least ${minUrls}`);
	}
	return locs;
}

function checkRobots(dir, siteUrl, err) {
	const file = join(dir, 'robots.txt');
	if (!existsSync(file)) {
		err('robots.txt', 'missing');
		return;
	}
	const lines = new Set(
		readFileSync(file, 'utf8')
			.split(/\r?\n/)
			.map((l) => l.trim())
	);
	const base = new URL(siteUrl).pathname.replace(/\/$/, '');
	for (const want of [
		'User-agent: *',
		'Allow: /',
		`Disallow: ${base}/print/`,
		`Disallow: ${base}/agent/inquire/`,
		`Sitemap: ${siteUrl}/sitemap.xml`
	]) {
		if (!lines.has(want)) err('robots.txt', `missing line "${want}"`);
	}
}

/** Head tags and share card of one indexable page. */
function checkHead(dir, rel, html, siteUrl, seen, cards, err) {
	const e = (msg) => err(rel, msg);
	const metas = tags(html, 'meta');
	const links = tags(html, 'link');
	const named = (n) => metas.filter((m) => m.name?.toLowerCase() === n);
	const prop = (p) => metas.filter((m) => m.property?.toLowerCase() === p);
	const one = (list, label) => {
		if (list.length !== 1) {
			e(`expected exactly one ${label}, found ${list.length}`);
			return undefined;
		}
		return list[0].content ?? list[0].href;
	};

	const titles = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => text(m[1]));
	if (titles.length !== 1 || !titles[0]) {
		e(`expected exactly one non-empty <title>, found ${titles.length}`);
	} else if (seen.titles.has(titles[0])) {
		e(`duplicate <title> "${titles[0]}" (also on ${seen.titles.get(titles[0])})`);
	} else seen.titles.set(titles[0], rel);

	const description = one(named('description'), 'meta description');
	if (description !== undefined) {
		if (!description.trim()) e('meta description is empty');
		else if (seen.descriptions.has(description)) {
			e(`duplicate meta description (also on ${seen.descriptions.get(description)})`);
		} else seen.descriptions.set(description, rel);
	}

	const expected = siteUrl + pagePath(rel);
	const canonical = one(
		links.filter((l) => l.rel?.toLowerCase() === 'canonical'),
		'link rel="canonical"'
	);
	if (canonical !== undefined && canonical !== expected) {
		e(`canonical is "${canonical}", expected "${expected}"`);
	}

	const ogType = one(prop('og:type'), 'og:type');
	if (ogType !== undefined && ogType !== 'website') e(`og:type is "${ogType}", expected "website"`);
	for (const p of ['og:title', 'og:description']) {
		const v = one(prop(p), p);
		if (v !== undefined && !v.trim()) e(`${p} is empty`);
	}
	const ogUrl = one(prop('og:url'), 'og:url');
	if (ogUrl !== undefined && ogUrl !== expected) {
		e(`og:url "${ogUrl}" must equal the canonical "${expected}"`);
	}

	const image = one(prop('og:image'), 'og:image');
	if (image !== undefined) {
		const prefix = `${siteUrl}/og/`;
		const name = image.startsWith(prefix) ? image.slice(prefix.length) : '';
		if (!/^[A-Za-z0-9._-]+\.png$/.test(name) || name.includes('..')) {
			e(`og:image "${image}" must be <siteUrl>/og/<name>.png`);
		} else {
			const ogRel = `og/${name}`;
			const file = join(dir, 'og', name);
			if (!existsSync(file)) e(`og:image file ${ogRel} not emitted`);
			else {
				cards.add(ogRel);
				const buf = readFileSync(file);
				const size = pngSize(buf);
				if (!size) e(`${ogRel} is not a PNG`);
				else if (size.width !== OG_WIDTH || size.height !== OG_HEIGHT) {
					e(`${ogRel} is ${size.width}x${size.height}, expected ${OG_WIDTH}x${OG_HEIGHT}`);
				}
				if (buf.length > OG_MAX_BYTES) {
					e(`${ogRel} is ${buf.length} bytes, over the ${OG_MAX_BYTES}-byte limit`);
				}
			}
		}
	}
	const w = one(prop('og:image:width'), 'og:image:width');
	if (w !== undefined && w !== String(OG_WIDTH))
		e(`og:image:width is "${w}", expected "${OG_WIDTH}"`);
	const h = one(prop('og:image:height'), 'og:image:height');
	if (h !== undefined && h !== String(OG_HEIGHT)) {
		e(`og:image:height is "${h}", expected "${OG_HEIGHT}"`);
	}
	const alt = prop('og:image:alt');
	if (alt.length !== 1 || !alt[0].content?.trim()) e('og:image:alt missing or empty');
	const card = named('twitter:card');
	if (card.length !== 1 || card[0].content !== 'summary_large_image') {
		e(`twitter:card is "${card[0]?.content ?? ''}", expected "summary_large_image"`);
	}
}

/** JSON-LD contract of a tools/<slug>/ calculator page. */
function checkToolLd(rel, html, err) {
	const e = (msg) => err(rel, msg);
	const blocks = [...html.matchAll(LD_JSON)].filter(([, attrs]) => LD_TYPE.test(attrs));
	if (blocks.length === 0) {
		e('no application/ld+json block');
		return;
	}
	const nodes = [];
	for (const [, , body] of blocks) {
		if (/aggregateRating/i.test(body) || /"review"/.test(body)) {
			e('ld+json must not carry aggregateRating or review');
		}
		try {
			nodes.push(...ldNodes(JSON.parse(body)));
		} catch {
			e('ld+json block is not valid JSON');
		}
	}
	const types = new Set(nodes.flatMap(typesOf));
	for (const t of ['WebApplication', 'FAQPage']) {
		if (!types.has(t)) e(`ld+json @type set lacks ${t}`);
	}
	const faq = nodes.find((n) => typesOf(n).includes('FAQPage'));
	const jsonQuestions = (Array.isArray(faq?.mainEntity) ? faq.mainEntity : []).map((q) =>
		String(q?.name ?? '')
			.replace(/\s+/g, ' ')
			.trim()
	);
	const section = /<section\b[^>]*\bid="questions"[^>]*>([\s\S]*?)<\/section>/i.exec(html);
	if (!section) {
		e('no visible FAQ <section id="questions" aria-labelledby="questions-heading">');
		return;
	}
	if (!/aria-labelledby="questions-heading"/i.test(section[0].slice(0, section[0].indexOf('>')))) {
		e('FAQ section must carry aria-labelledby="questions-heading"');
	}
	const visible = [...section[1].matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) => text(m[1]));
	if (faq && JSON.stringify(jsonQuestions) !== JSON.stringify(visible)) {
		e(
			`FAQPage questions ${JSON.stringify(jsonQuestions)} differ from the visible FAQ ${JSON.stringify(visible)}`
		);
	}
}

/** URL hygiene that applies to every built HTML file. */
function checkUrls(rel, html, siteUrl, err) {
	const dotdot = ABS_DOTDOT.exec(html);
	if (dotdot) err(rel, `'..' inside an absolute URL attribute: ${dotdot[0]}`);
	for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)) {
		const u = decode(src);
		const external = /^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//');
		if (external && !u.startsWith(siteUrl + '/')) err(rel, `third-party script src ${u}`);
	}
}

/**
 * Returns [] when the build satisfies the SEO contract; otherwise one string per fault, each
 * prefixed with the build-relative file it concerns.
 * @param {string} dir
 * @param {{ siteUrl: string; minUrls?: number }} opts
 * @returns {string[]}
 */
export function checkSeo(dir, { siteUrl, minUrls = 1 }) {
	if (!existsSync(dir)) return [`${dir}: build directory missing`];
	return collect(dir, { siteUrl, minUrls }).errors;
}

/**
 * The oracle proper, plus the counts the CLI prints on success.
 * @param {string} dir
 * @param {{ siteUrl: string; minUrls?: number }} opts
 */
export function collect(dir, { siteUrl, minUrls = 1 }) {
	/** @type {string[]} */
	const errors = [];
	const err = (file, msg) => errors.push(`${file}: ${msg}`);
	const html = walk(dir)
		.filter((f) => f.endsWith('.html'))
		.map((f) => ({ rel: relative(dir, f).split(sep).join('/'), src: readFileSync(f, 'utf8') }));
	const pages = html.filter((p) => p.rel === 'index.html' || p.rel.endsWith('/index.html'));
	const indexable = pages.filter((p) => !isNoindex(tags(p.src, 'meta')));
	const noindex = pages.filter((p) => !indexable.includes(p));

	const locs = checkSitemap(dir, siteUrl, minUrls, err);
	checkRobots(dir, siteUrl, err);
	if (locs) {
		const locSet = new Set(locs);
		const wanted = new Map(indexable.map((p) => [siteUrl + pagePath(p.rel), p.rel]));
		for (const [url, rel] of wanted) {
			if (!locSet.has(url)) err(rel, `indexable page missing from sitemap.xml (expected ${url})`);
		}
		const noindexUrls = new Map(noindex.map((p) => [siteUrl + pagePath(p.rel), p.rel]));
		for (const loc of locSet) {
			if (noindexUrls.has(loc)) {
				err(noindexUrls.get(loc), `noindex page is listed in sitemap.xml (${loc})`);
			} else if (!wanted.has(loc) && loc.startsWith(siteUrl + '/')) {
				err('sitemap.xml', `loc ${loc} has no indexable page in the build`);
			}
		}
	}

	const seen = { titles: new Map(), descriptions: new Map() };
	const cards = new Set();
	for (const p of indexable) {
		checkHead(dir, p.rel, p.src.replace(/<!--[\s\S]*?-->/g, ''), siteUrl, seen, cards, err);
	}
	for (const p of pages.filter((p) => TOOL_PAGE.test(p.rel))) checkToolLd(p.rel, p.src, err);
	for (const p of html) checkUrls(p.rel, p.src, siteUrl, err);

	return { errors, pages: pages.length, urls: locs?.length ?? 0, cards: cards.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const usage =
		'usage: node scripts/assert-seo.mjs <dir> [--target root|sub|configured] [--min-urls N]';
	const args = process.argv.slice(2);
	const valueOf = (flag) => {
		const i = args.indexOf(flag);
		if (i === -1) return undefined;
		const v = args[i + 1];
		if (!v || v.startsWith('--')) throw new Error(`${flag} needs a value`);
		return v;
	};
	let siteUrl;
	let minUrls;
	let dir;
	try {
		const target = valueOf('--target');
		const min = valueOf('--min-urls');
		minUrls = min === undefined ? DEFAULT_MIN_URLS : Number(min);
		if (!Number.isInteger(minUrls) || minUrls < 0) throw new Error('--min-urls must be an integer');
		const env = { ...process.env, ...(target ? targetEnv(target) : {}) };
		siteUrl = resolveSiteOrigin(env) + resolveBasePath(env);
		dir =
			args.find(
				(a, i) => !a.startsWith('--') && !['--target', '--min-urls'].includes(args[i - 1])
			) ?? 'build';
	} catch (e) {
		console.error(`${e.message}\n${usage}`);
		process.exit(2);
	}
	if (!existsSync(dir)) {
		console.error(`SEO assertion failed: build directory ${dir} does not exist`);
		process.exit(1);
	}
	const { errors, pages, urls, cards } = collect(dir, { siteUrl, minUrls });
	if (errors.length) {
		console.error(
			`SEO assertion failed (${errors.length}) for ${siteUrl}:\n- ` + errors.join('\n- ')
		);
		process.exit(1);
	}
	console.log(
		`SEO assertion passed for ${pages} pages, ${urls} sitemap URLs, ${cards} share cards in ${dir}`
	);
}
