import { describe, expect, test } from 'vitest';

import {
	SOCIAL_MARKERS,
	buildHashtagCandidates,
	parseHashtagLine,
	parseSocialPack,
	splitTrailingHashtags
} from './social-sections.js';

const WELL_FORMED = [
	'Here are your posts:',
	'',
	'=== INSTAGRAM ===',
	'Just listed in Harlow Springs: three bedrooms and a fenced yard.',
	'=== INSTAGRAM HASHTAGS ===',
	'#JustListed #HarlowSprings #RealEstate',
	'=== FACEBOOK ===',
	'Come see this three-bedroom home this weekend.',
	'#JustListed #HarlowSprings',
	'=== LINKEDIN ===',
	'A new listing in Harlow Springs with a fenced yard.',
	''
].join('\n');

describe('SOCIAL_MARKERS', () => {
	test('names the four section markers', () => {
		expect(SOCIAL_MARKERS).toEqual({
			instagram: 'INSTAGRAM',
			instagramHashtags: 'INSTAGRAM HASHTAGS',
			facebook: 'FACEBOOK',
			linkedin: 'LINKEDIN'
		});
	});
});

describe('parseSocialPack', () => {
	test('splits a well-formed pack into three ok sections', () => {
		const pack = parseSocialPack(WELL_FORMED);
		expect(pack.instagram).toEqual({
			ok: true,
			body: 'Just listed in Harlow Springs: three bedrooms and a fenced yard.',
			tags: ['#JustListed', '#HarlowSprings', '#RealEstate']
		});
		expect(pack.facebook).toEqual({
			ok: true,
			body: 'Come see this three-bedroom home this weekend.',
			tags: ['#JustListed', '#HarlowSprings']
		});
		expect(pack.linkedin).toEqual({
			ok: true,
			body: 'A new listing in Harlow Springs with a fenced yard.',
			tags: []
		});
		expect(pack.active).toBeNull();
	});

	test("ignores prose before the first marker ('Here are your posts:')", () => {
		const pack = parseSocialPack(WELL_FORMED);
		for (const key of ['instagram', 'facebook', 'linkedin'] as const) {
			const section = pack[key];
			expect(section.ok).toBe(true);
			if (section.ok) expect(section.body).not.toContain('Here are your posts:');
		}
	});

	test('accepts marker case and spacing variants', () => {
		const text = [
			'=== instagram ===',
			'IG body',
			'===Instagram Hashtags===',
			'#Condo',
			'===Facebook===',
			'FB body',
			'  === LinkedIn ===  ',
			'LI body'
		].join('\r\n');
		const pack = parseSocialPack(text);
		expect(pack.instagram).toEqual({ ok: true, body: 'IG body', tags: ['#Condo'] });
		expect(pack.facebook).toEqual({ ok: true, body: 'FB body', tags: [] });
		expect(pack.linkedin).toEqual({ ok: true, body: 'LI body', tags: [] });
	});

	test("a missing FACEBOOK marker is reason: 'missing' and the other two stay ok", () => {
		const text = ['=== INSTAGRAM ===', 'IG body', '=== LINKEDIN ===', 'LI body'].join('\n');
		const pack = parseSocialPack(text);
		expect(pack.facebook).toEqual({ ok: false, reason: 'missing' });
		expect(pack.instagram.ok).toBe(true);
		expect(pack.linkedin.ok).toBe(true);
	});

	test("a marker with only whitespace is reason: 'empty'", () => {
		const text = [
			'=== INSTAGRAM ===',
			'IG body',
			'=== FACEBOOK ===',
			'   ',
			'',
			'=== LINKEDIN ===',
			'LI body'
		].join('\n');
		expect(parseSocialPack(text).facebook).toEqual({ ok: false, reason: 'empty' });
	});

	test('a section holding only a hashtag line is empty, not a silent empty card', () => {
		const text = ['=== FACEBOOK ===', '#JustListed'].join('\n');
		expect(parseSocialPack(text).facebook).toEqual({ ok: false, reason: 'empty' });
	});

	test('instagram without a hashtags section splits trailing tags from the body', () => {
		const text = ['=== INSTAGRAM ===', 'IG body', '', '#OpenHouse #Condo'].join('\n');
		expect(parseSocialPack(text).instagram).toEqual({
			ok: true,
			body: 'IG body',
			tags: ['#OpenHouse', '#Condo']
		});
	});

	test('no markers at all reports all three missing', () => {
		const pack = parseSocialPack('Sorry, I cannot help with that.');
		expect(pack.instagram).toEqual({ ok: false, reason: 'missing' });
		expect(pack.facebook).toEqual({ ok: false, reason: 'missing' });
		expect(pack.linkedin).toEqual({ ok: false, reason: 'missing' });
	});

	test('streaming reports the platform whose section is arriving', () => {
		expect(parseSocialPack('=== INSTAGRAM ===\nHi', { streaming: true }).active).toBe('instagram');
		expect(
			parseSocialPack('=== INSTAGRAM ===\nHi\n=== INSTAGRAM HASHTAGS ===\n#A', { streaming: true })
				.active
		).toBe('instagram');
		expect(
			parseSocialPack('=== INSTAGRAM ===\nHi\n=== FACEBOOK ===\nHey', { streaming: true }).active
		).toBe('facebook');
		expect(parseSocialPack('Here are', { streaming: true }).active).toBeNull();
		expect(parseSocialPack('=== INSTAGRAM ===\nHi\n=== FACEBOOK ===\nHey').active).toBeNull();
		expect(
			parseSocialPack('=== INSTAGRAM ===\nHi\n=== FACEBOOK ===\nHey', { streaming: false }).active
		).toBeNull();
	});
});

describe('splitTrailingHashtags', () => {
	test('splits a trailing hashtag-only line and trims the body', () => {
		expect(splitTrailingHashtags('Hello there.\n\n#A #B  \n')).toEqual({
			body: 'Hello there.',
			tags: ['#A', '#B']
		});
	});

	test('leaves inline hashtags in prose alone', () => {
		expect(splitTrailingHashtags('Tour it #today with us.')).toEqual({
			body: 'Tour it #today with us.',
			tags: []
		});
	});
});

describe('parseHashtagLine', () => {
	test("'#JustListed #HarlowSprings, #Condo #' drops the bare '#'", () => {
		expect(parseHashtagLine('#JustListed #HarlowSprings, #Condo #')).toEqual([
			'#JustListed',
			'#HarlowSprings',
			'#Condo'
		]);
	});

	test('ignores words without a hash and deduplicates', () => {
		expect(parseHashtagLine('#A word #A #B')).toEqual(['#A', '#B']);
	});
});

describe('buildHashtagCandidates', () => {
	test('fixed order from post type, area, property type and a generic tag', () => {
		expect(
			buildHashtagCandidates({
				cityOrArea: 'Harlow Springs',
				propertyType: 'Condo',
				postType: 'open-house'
			})
		).toEqual(['#OpenHouse', '#HarlowSpringsRealEstate', '#HarlowSprings', '#Condo', '#RealEstate']);
	});

	test('maps post types', () => {
		const base = { cityOrArea: '' } as const;
		expect(buildHashtagCandidates({ ...base, postType: 'just-listed' })[0]).toBe('#JustListed');
		expect(buildHashtagCandidates({ ...base, postType: 'price-change' })[0]).toBe(
			'#PriceImprovement'
		);
		expect(buildHashtagCandidates({ ...base, postType: 'market-update' })[0]).toBe(
			'#MarketUpdate'
		);
		expect(buildHashtagCandidates({ ...base, postType: 'other' })).toEqual(['#RealEstate']);
	});

	test('maps property types and strips non-alphanumerics', () => {
		expect(
			buildHashtagCandidates({ cityOrArea: '', propertyType: 'Single family', postType: 'other' })
		).toEqual(['#SingleFamilyHome', '#RealEstate']);
		expect(
			buildHashtagCandidates({ cityOrArea: '', propertyType: 'Multi-family', postType: 'other' })
		).toEqual(['#MultiFamily', '#RealEstate']);
		expect(
			buildHashtagCandidates({ cityOrArea: "St. Mary's", postType: 'just-listed' })
		).toEqual(['#JustListed', '#StMarysRealEstate', '#StMarys', '#RealEstate']);
	});

	test('an empty city gives no city tags', () => {
		expect(
			buildHashtagCandidates({ cityOrArea: '   ', propertyType: 'Condo', postType: 'just-listed' })
		).toEqual(['#JustListed', '#Condo', '#RealEstate']);
	});

	test('only typed place and property words appear (never people)', () => {
		const tags = buildHashtagCandidates({
			cityOrArea: 'Harlow Springs',
			propertyType: 'Townhouse',
			postType: 'market-update'
		});
		const allowed = new Set([
			'#MarketUpdate',
			'#HarlowSpringsRealEstate',
			'#HarlowSprings',
			'#Townhouse',
			'#RealEstate'
		]);
		for (const tag of tags) expect(allowed.has(tag)).toBe(true);
	});
});
