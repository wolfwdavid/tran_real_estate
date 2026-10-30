// Mutation tests for scripts/assert-seo.mjs: a runtime-generated golden build directory passes,
// and every rule the oracle claims to enforce is proven by injecting exactly one fault into a fresh
// copy of that golden build. Fixtures live only under os.tmpdir(); nothing is written into the repo.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { afterAll, describe, expect, test } from 'vitest';
import { checkSeo } from './assert-seo.mjs';

const SITE = 'https://wolfwdavid.github.io/tran_real_estate';

/** One PNG chunk: length, type, data, CRC over type + data. */
function chunk(type: string, data: Buffer): Buffer {
	const head = Buffer.alloc(8);
	head.writeUInt32BE(data.length, 0);
	head.write(type, 4, 'ascii');
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
	return Buffer.concat([head, data, crc]);
}

/** A valid, decodable RGB PNG (all black). `padBytes` adds an ancillary chunk to inflate the file. */
function png(width: number, height: number, padBytes = 0): Buffer {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr.writeUInt8(8, 8); // bit depth
	ihdr.writeUInt8(2, 9); // colour type: truecolour
	const raw = Buffer.alloc(height * (1 + width * 3)); // filter byte 0 + zeroed pixels per row
	const parts = [
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw))
	];
	if (padBytes > 0) parts.push(chunk('zzPD', Buffer.alloc(padBytes, 0x5a)));
	parts.push(chunk('IEND', Buffer.alloc(0)));
	return Buffer.concat(parts);
}

type Head = {
	path: string;
	title: string;
	description: string;
	image: string;
};

function head({ path, title, description, image }: Head): string {
	const url = SITE + path;
	return [
		`<meta charset="utf-8" />`,
		`<title>${title}</title>`,
		`<meta name="description" content="${description}" />`,
		`<link rel="canonical" href="${url}" />`,
		`<meta property="og:type" content="website" />`,
		`<meta property="og:title" content="${title}" />`,
		`<meta property="og:description" content="${description}" />`,
		`<meta property="og:url" content="${url}" />`,
		`<meta property="og:image" content="${SITE}/og/${image}.png" />`,
		`<meta property="og:image:width" content="1200" />`,
		`<meta property="og:image:height" content="630" />`,
		`<meta property="og:image:alt" content="${title} share card" />`,
		`<meta name="twitter:card" content="summary_large_image" />`,
		`<link rel="modulepreload" href="../../_app/immutable/entry/start.js" />`
	].join('\n\t\t');
}

const page = (headHtml: string, body: string) =>
	`<!doctype html>\n<html lang="en">\n\t<head>\n\t\t${headHtml}\n\t</head>\n\t<body>${body}</body>\n</html>\n`;

const QUESTIONS = [
	'What is a cap rate?',
	'Is a higher cap rate better?',
	'Does this include debt & taxes?'
];

const LD = JSON.stringify([
	{
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Cap rate calculator',
		applicationCategory: 'FinanceApplication',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
	},
	{
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: QUESTIONS.map((q) => ({
			'@type': 'Question',
			name: q,
			acceptedAnswer: { '@type': 'Answer', text: 'An answer.' }
		}))
	}
]).replace(/&/g, '\\u0026');

const FAQ = `<section id="questions" aria-labelledby="questions-heading"><h2 id="questions-heading">Questions</h2>${QUESTIONS.map(
	(q) => `<h3><!---->${q.replace('&', '&amp;')}</h3><p>An answer.</p>`
).join('')}</section>`;

function sitemap(locs: string[]): string {
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs
		.map((l) => `\t<url><loc>${l}</loc></url>`)
		.join('\n')}\n</urlset>\n`;
}

const ROBOTS = [
	'User-agent: *',
	'Allow: /',
	'Disallow: /tran_real_estate/print/',
	'Disallow: /tran_real_estate/agent/inquire/',
	`Sitemap: ${SITE}/sitemap.xml`,
	''
].join('\n');

type Files = Record<string, string | Buffer>;

function golden(): Files {
	return {
		'index.html': page(
			head({
				path: '/',
				title: 'Tran Real Estate Tools',
				description: 'Free real estate tools for renters, investors and agents.',
				image: 'default'
			}),
			'<main><h1>Tran Real Estate Tools</h1><script src="../frame-guard.js"></script></main>'
		),
		'tools/cap-rate/index.html': page(
			head({
				path: '/tools/cap-rate/',
				title: 'Cap rate calculator | Tran Real Estate Tools',
				description: 'Work out a property cap rate from rent, expenses and price.',
				image: 'cap-rate'
			}) + `\n\t\t<script type="application/ld+json">${LD}</script>`,
			`<main><h1>Cap rate calculator</h1>${FAQ}</main>`
		),
		'renter/index.html': page(
			'<meta charset="utf-8" />\n\t\t<title>Renter portal</title>\n\t\t<meta name="robots" content="noindex" />',
			'<main><h1>Renter</h1></main>'
		),
		'404.html': page('<title>Not found</title>', '<main>Not found</main>'),
		'sitemap.xml': sitemap([`${SITE}/`, `${SITE}/tools/cap-rate/`]),
		'robots.txt': ROBOTS,
		'og/default.png': png(1200, 630),
		'og/cap-rate.png': png(1200, 630),
		'_app/immutable/entry/start.js': 'export const x = 1;\n'
	};
}

const roots: string[] = [];
afterAll(() => {
	for (const r of roots) rmSync(r, { recursive: true, force: true });
});

/** Writes the golden build (after `mutate`) into a fresh temp dir and returns the oracle's errors. */
function run(mutate: (f: Files) => void = () => {}, opts: { minUrls?: number } = {}): string[] {
	const files = golden();
	mutate(files);
	const dir = mkdtempSync(join(tmpdir(), 'tran-seo-'));
	roots.push(dir);
	for (const [rel, content] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true });
		writeFileSync(join(dir, rel), content);
	}
	return checkSeo(dir, { siteUrl: SITE, ...opts });
}

const edit = (f: Files, rel: string, from: string | RegExp, to: string) => {
	const before = String(f[rel]);
	const after = before.replace(from, to);
	if (after === before) throw new Error(`fixture edit did not apply to ${rel}: ${String(from)}`);
	f[rel] = after;
};

const expectFault = (errors: string[], pattern: RegExp) => {
	expect(errors.length).toBeGreaterThan(0);
	expect(errors).toContainEqual(expect.stringMatching(pattern));
};

describe('checkSeo golden build', () => {
	test('a correct build passes with no errors', () => {
		expect(run()).toEqual([]);
	});

	test('the PNG helper produces the declared IHDR size and the requested padding', () => {
		const p = png(1200, 630, 1000);
		expect(p.readUInt32BE(16)).toBe(1200);
		expect(p.readUInt32BE(20)).toBe(630);
		expect(p.length).toBeGreaterThan(png(1200, 630).length + 1000);
	});
});

describe('checkSeo sitemap rules', () => {
	test('a missing sitemap.xml is reported', () => {
		expectFault(
			run((f) => delete f['sitemap.xml']),
			/^sitemap\.xml: missing/
		);
	});

	test('a sitemap without the sitemaps.org urlset is reported', () => {
		expectFault(
			run((f) => edit(f, 'sitemap.xml', 'http://www.sitemaps.org/schemas/sitemap/0.9', 'x')),
			/^sitemap\.xml: .*urlset/
		);
	});

	test('a loc not under the site URL is reported', () => {
		expectFault(
			run((f) =>
				edit(f, 'sitemap.xml', `${SITE}/tools/cap-rate/`, 'https://evil.example/tools/cap-rate/')
			),
			/^sitemap\.xml: .*evil\.example.*not under/
		);
	});

	test("a loc containing '..' is reported", () => {
		expectFault(
			run((f) =>
				edit(f, 'sitemap.xml', `${SITE}/tools/cap-rate/`, `${SITE}/tools/../tools/cap-rate/`)
			),
			/^sitemap\.xml: .*'\.\.'/
		);
	});

	test('an indexable page missing from the sitemap is reported', () => {
		expectFault(
			run((f) => (f['sitemap.xml'] = sitemap([`${SITE}/`]))),
			/^tools\/cap-rate\/index\.html: indexable page missing from sitemap\.xml/
		);
	});

	test('a noindex page listed in the sitemap is reported', () => {
		expectFault(
			run(
				(f) =>
					(f['sitemap.xml'] = sitemap([`${SITE}/`, `${SITE}/tools/cap-rate/`, `${SITE}/renter/`]))
			),
			/^renter\/index\.html: noindex page is listed in sitemap\.xml/
		);
	});

	test('a page with neither noindex nor a sitemap entry is reported', () => {
		expectFault(
			run((f) => {
				f['agent/index.html'] = page(
					'<meta charset="utf-8" />\n\t\t<title>Agent portal</title>',
					'<main>Agent</main>'
				);
			}),
			/^agent\/index\.html: indexable page missing from sitemap\.xml/
		);
	});

	test('a sitemap loc with no emitted page is reported', () => {
		expectFault(
			run(
				(f) =>
					(f['sitemap.xml'] = sitemap([`${SITE}/`, `${SITE}/tools/cap-rate/`, `${SITE}/gone/`]))
			),
			/^sitemap\.xml: .*\/gone\/.*no indexable page/
		);
	});

	test('fewer sitemap URLs than minUrls is reported (non-vacuity)', () => {
		expect(run(() => {}, { minUrls: 2 })).toEqual([]);
		expectFault(
			run(() => {}, { minUrls: 14 }),
			/^sitemap\.xml: 2 URLs, expected at least 14/
		);
	});
});

describe('checkSeo robots.txt rules', () => {
	test('robots.txt without the Sitemap line is reported', () => {
		expectFault(
			run((f) => edit(f, 'robots.txt', `Sitemap: ${SITE}/sitemap.xml\n`, '')),
			/^robots\.txt: missing line "Sitemap: /
		);
	});

	test('robots.txt missing the print Disallow is reported', () => {
		expectFault(
			run((f) => edit(f, 'robots.txt', 'Disallow: /tran_real_estate/print/\n', '')),
			/^robots\.txt: missing line "Disallow: \/tran_real_estate\/print\/"/
		);
	});

	test('robots.txt missing the agent/inquire Disallow is reported', () => {
		expectFault(
			run((f) => edit(f, 'robots.txt', 'Disallow: /tran_real_estate/agent/inquire/\n', '')),
			/^robots\.txt: missing line "Disallow: \/tran_real_estate\/agent\/inquire\/"/
		);
	});
});

describe('checkSeo head tag rules', () => {
	test('a duplicated <title> across two pages is reported', () => {
		expectFault(
			run((f) =>
				edit(
					f,
					'tools/cap-rate/index.html',
					'<title>Cap rate calculator | Tran Real Estate Tools</title>',
					'<title>Tran Real Estate Tools</title>'
				)
			),
			/^tools\/cap-rate\/index\.html: duplicate <title> .*index\.html/
		);
	});

	test('a missing meta description is reported', () => {
		expectFault(
			run((f) => edit(f, 'index.html', /<meta name="description"[^>]*>/, '')),
			/^index\.html: expected exactly one meta description/
		);
	});

	test('a duplicated meta description is reported', () => {
		expectFault(
			run((f) =>
				edit(
					f,
					'tools/cap-rate/index.html',
					/<meta name="description" content="[^"]*"/,
					'<meta name="description" content="Free real estate tools for renters, investors and agents."'
				)
			),
			/^tools\/cap-rate\/index\.html: duplicate meta description/
		);
	});

	test('a canonical not equal to siteUrl + path is reported', () => {
		expectFault(
			run((f) =>
				edit(
					f,
					'tools/cap-rate/index.html',
					`<link rel="canonical" href="${SITE}/tools/cap-rate/"`,
					`<link rel="canonical" href="${SITE}/tools/cap-rate"`
				)
			),
			/^tools\/cap-rate\/index\.html: canonical is .*expected .*\/tools\/cap-rate\/"/
		);
	});

	test('og:url different from canonical is reported', () => {
		expectFault(
			run((f) =>
				edit(
					f,
					'index.html',
					`<meta property="og:url" content="${SITE}/"`,
					`<meta property="og:url" content="${SITE}/for-renters/"`
				)
			),
			/^index\.html: og:url .* must equal the canonical/
		);
	});

	test('a missing og:image:alt is reported', () => {
		expectFault(
			run((f) => edit(f, 'index.html', /<meta property="og:image:alt"[^>]*>/, '')),
			/^index\.html: og:image:alt missing or empty/
		);
	});

	test('a twitter:card other than summary_large_image is reported', () => {
		expectFault(
			run((f) => edit(f, 'index.html', 'content="summary_large_image"', 'content="summary"')),
			/^index\.html: twitter:card is "summary", expected "summary_large_image"/
		);
	});
});

describe('checkSeo share card rules', () => {
	test('an og:image whose file was not emitted is reported', () => {
		expectFault(
			run((f) => delete f['og/cap-rate.png']),
			/^tools\/cap-rate\/index\.html: og:image file og\/cap-rate\.png not emitted/
		);
	});

	test('an og:image PNG of 1200x600 is reported', () => {
		expectFault(
			run((f) => (f['og/default.png'] = png(1200, 600))),
			/^index\.html: og\/default\.png is 1200x600, expected 1200x630/
		);
	});

	test('an og:image over 200 KB is reported', () => {
		expectFault(
			run((f) => (f['og/default.png'] = png(1200, 630, 210 * 1024))),
			/^index\.html: og\/default\.png is \d+ bytes, over the 204800-byte limit/
		);
	});

	test('an og:image outside <siteUrl>/og/ is reported', () => {
		expectFault(
			run((f) =>
				edit(f, 'index.html', `${SITE}/og/default.png`, 'https://cdn.example.org/default.png')
			),
			/^index\.html: og:image .* must be <siteUrl>\/og\/<name>\.png/
		);
	});
});

describe('checkSeo JSON-LD rules on tool pages', () => {
	test('a tools page without ld+json is reported', () => {
		expectFault(
			run((f) =>
				edit(
					f,
					'tools/cap-rate/index.html',
					/<script type="application\/ld\+json">[\s\S]*?<\/script>/,
					''
				)
			),
			/^tools\/cap-rate\/index\.html: no application\/ld\+json block/
		);
	});

	test('ld+json without WebApplication is reported', () => {
		expectFault(
			run((f) => edit(f, 'tools/cap-rate/index.html', '"WebApplication"', '"SoftwareApplication"')),
			/^tools\/cap-rate\/index\.html: ld\+json @type set lacks WebApplication/
		);
	});

	test('ld+json carrying aggregateRating is reported', () => {
		expectFault(
			run((f) =>
				edit(
					f,
					'tools/cap-rate/index.html',
					'"applicationCategory"',
					'"aggregateRating":{"@type":"AggregateRating","ratingValue":"5"},"applicationCategory"'
				)
			),
			/^tools\/cap-rate\/index\.html: ld\+json must not carry aggregateRating or review/
		);
	});

	test('ld+json carrying a review is reported', () => {
		expectFault(
			run((f) =>
				edit(
					f,
					'tools/cap-rate/index.html',
					'"applicationCategory"',
					'"review":[],"applicationCategory"'
				)
			),
			/^tools\/cap-rate\/index\.html: ld\+json must not carry aggregateRating or review/
		);
	});

	test('FAQPage questions differing from the visible h3 list are reported', () => {
		expectFault(
			run((f) =>
				edit(
					f,
					'tools/cap-rate/index.html',
					'<h3><!---->Is a higher cap rate better?</h3>',
					'<h3>Is a higher cap rate always better?</h3>'
				)
			),
			/^tools\/cap-rate\/index\.html: FAQPage questions .* differ from the visible FAQ/
		);
	});

	test('invalid ld+json is reported', () => {
		expectFault(
			run((f) => edit(f, 'tools/cap-rate/index.html', '"FAQPage",', '"FAQPage"')),
			/^tools\/cap-rate\/index\.html: ld\+json block is not valid JSON/
		);
	});
});

describe('checkSeo URL hygiene on every HTML file', () => {
	test("'..' inside an absolute URL attribute is reported", () => {
		expectFault(
			run((f) =>
				edit(f, '404.html', '<main>', `<main><a href="${SITE}/tools/../legal/terms/">x</a>`)
			),
			/^404\.html: '\.\.' inside an absolute URL/
		);
	});

	test('a third-party script src is reported', () => {
		expectFault(
			run((f) =>
				edit(
					f,
					'index.html',
					'</main>',
					'<script src="https://cdn.example.org/x.js"></script></main>'
				)
			),
			/^index\.html: third-party script src https:\/\/cdn\.example\.org\/x\.js/
		);
	});

	test('a protocol-relative script src is reported', () => {
		expectFault(
			run((f) =>
				edit(f, 'index.html', '</main>', '<script src="//cdn.example.org/x.js"></script></main>')
			),
			/^index\.html: third-party script src \/\/cdn\.example\.org\/x\.js/
		);
	});
});
