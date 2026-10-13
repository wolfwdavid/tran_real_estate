/**
 * Structured data (schema.org JSON-LD) for the marketing pages.
 *
 * Render with `<svelte:element this={tag} type="application/ld+json">{serializeJsonLd(data)}</svelte:element>`.
 * Svelte entity-escapes text inside that element and script raw text is never entity-decoded, so
 * `<`, `>` and `&` must already be JSON `\u` escapes (RESEARCH Pitfall 6). That also rules out a
 * `</script>` breakout. U+2028/U+2029 are escaped for old JavaScript parsers.
 */
export const serializeJsonLd = (data: object): string =>
	JSON.stringify(data).replace(
		/[<>&\u2028\u2029]/g,
		(c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
	);

export interface JsonLdTool {
	name: string;
	description: string;
	url: string;
}

export const webApplication = (t: JsonLdTool) => ({
	'@context': 'https://schema.org',
	'@type': 'WebApplication',
	name: t.name,
	description: t.description,
	url: t.url,
	applicationCategory: 'FinanceApplication',
	operatingSystem: 'Any',
	browserRequirements: 'Requires JavaScript',
	isAccessibleForFree: true,
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
	// NEVER aggregateRating / review: fabricated ratings are banned.
});

export interface FaqEntry {
	q: string;
	a: string;
}

/** FAQPage mirrors the visible FAQ word for word: pass the same array the page renders. */
export const faqPage = (faq: readonly FaqEntry[]) => ({
	'@context': 'https://schema.org',
	'@type': 'FAQPage',
	mainEntity: faq.map(({ q, a }) => ({
		'@type': 'Question',
		name: q,
		acceptedAnswer: { '@type': 'Answer', text: a }
	}))
});
