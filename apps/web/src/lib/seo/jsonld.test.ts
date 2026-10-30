import { describe, expect, test } from 'vitest';
import { faqPage, serializeJsonLd, webApplication } from './jsonld.js';

describe('serializeJsonLd', () => {
	test('escapes <, > and & so the text cannot break out of the script block', () => {
		const input = { name: 'Cash-on-cash & DSCR </script><b>' };
		const out = serializeJsonLd(input);
		expect(out).not.toMatch(/[<>&]/);
		expect(out).toContain('\\u003c');
		expect(out).toContain('\\u003e');
		expect(out).toContain('\\u0026');
		expect(JSON.parse(out)).toStrictEqual(input);
	});

	test('escapes U+2028 and U+2029 and still round-trips', () => {
		const input = { text: 'line\u2028sep\u2029para' };
		const out = serializeJsonLd(input);
		expect(out).not.toMatch(/[\u2028\u2029]/);
		expect(out).toContain('\\u2028');
		expect(out).toContain('\\u2029');
		expect(JSON.parse(out)).toStrictEqual(input);
	});

	test('round-trips a full WebApplication object', () => {
		const data = webApplication({
			name: 'Cash-on-cash & DSCR <tools>',
			description: 'd',
			url: 'https://wolfwdavid.github.io/tools/cash-on-cash/'
		});
		expect(JSON.parse(serializeJsonLd(data))).toStrictEqual(data);
	});
});

describe('webApplication', () => {
	const tool = {
		name: 'Cap rate calculator',
		description: 'd',
		url: 'https://wolfwdavid.github.io/tools/cap-rate/'
	};

	test('has exactly the free-app fields', () => {
		expect(webApplication(tool)).toStrictEqual({
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: 'Cap rate calculator',
			description: 'd',
			url: 'https://wolfwdavid.github.io/tools/cap-rate/',
			applicationCategory: 'FinanceApplication',
			operatingSystem: 'Any',
			browserRequirements: 'Requires JavaScript',
			isAccessibleForFree: true,
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
		});
	});

	test('never carries a rating or review', () => {
		const json = JSON.stringify(webApplication(tool));
		expect(json).not.toMatch(/aggregateRating/);
		expect(json).not.toMatch(/review/i);
	});
});

describe('faqPage', () => {
	test('mirrors the questions word for word', () => {
		expect(faqPage([{ q: 'What is a cap rate?', a: 'A.' }])).toStrictEqual({
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: [
				{
					'@type': 'Question',
					name: 'What is a cap rate?',
					acceptedAnswer: { '@type': 'Answer', text: 'A.' }
				}
			]
		});
	});

	test('keeps order and count', () => {
		const faq = [
			{ q: 'One?', a: '1' },
			{ q: 'Two?', a: '2' },
			{ q: 'Three?', a: '3' }
		];
		const page = faqPage(faq);
		expect(page.mainEntity.map((e) => e.name)).toStrictEqual(['One?', 'Two?', 'Three?']);
		expect(page.mainEntity.map((e) => e.acceptedAnswer.text)).toStrictEqual(['1', '2', '3']);
	});
});
