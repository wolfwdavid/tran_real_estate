import { describe, expect, it } from 'vitest';
import type { ListingFacts } from '@tran/core/studio';
import { computeGate, runChecks } from '$lib/ai/ui/panel-controller';
import {
	NUMBER_CATEGORIES,
	briefAllowedNumbers,
	listingAllowedNumbers,
	numberPostCheck,
	numberWordsPostCheck,
	reelAllowedNumbers,
	unsupportedFeaturePostCheck
} from './post-checks';

const facts = (over: Partial<ListingFacts> = {}): ListingFacts => ({
	listingType: 'sale',
	propertyType: 'Single family',
	bedrooms: 3,
	bathrooms: 2,
	features: ['Hardwood floors', 'Central air'],
	nearby: ['Parks'],
	tone: 'warm',
	length: 'medium',
	...over
});

describe('numberPostCheck', () => {
	const listing = numberPostCheck('listing', [3, 2, 1450]);

	it('passes numbers that are in the facts', () => {
		expect(listing('A 3-bedroom, 2-bath home with 1,450 square feet')).toEqual([]);
	});

	it('blocks a number that is not in the facts, with the listing copy and no replacement', () => {
		const text = 'A 3-bedroom, 2-bath home with 1,600 square feet';
		const f = listing(text);
		expect(f).toHaveLength(1);
		expect(f[0]!.severity).toBe('block');
		expect(text.slice(f[0]!.start, f[0]!.end)).toBe('1,600');
		const m = f[0]!.members[0]!;
		expect(m.categoryLabel).toBe('Number not in your facts');
		expect(m.explanation).toBe(NUMBER_CATEGORIES.listing.explanation);
		expect(m.alternative).toBe('');
		expect(m.checker).toBe('numbers');
	});

	it('uses each tool label', () => {
		const text = 'Median rent is $2,450.';
		expect(numberPostCheck('snapshot', [1850])(text)[0]!.members[0]!.categoryLabel).toBe(
			'Number not in this report'
		);
		expect(numberPostCheck('social', [])(text)[0]!.members[0]!.categoryLabel).toBe(
			'Number not in your brief'
		);
		expect(numberPostCheck('reel', [])(text)[0]!.members[0]!.categoryLabel).toBe(
			"Number you didn't provide"
		);
	});

	it('leaves number words to the number-word check (no duplicate finding)', () => {
		expect(numberPostCheck('listing', [])('Rents rose twelve percent')).toEqual([]);
	});

	it('gates exits through the unchanged Phase 5 controller', () => {
		const findings = runChecks('Offered at $510,000.', [numberPostCheck('listing', [499000])]);
		const gate = computeGate({ phase: 'ready', findings, warnAck: false });
		expect(gate.blocked).toBe(true);
		expect(gate.canExit).toBe(false);
	});
});

describe('numberWordsPostCheck', () => {
	it('flags number words above ten and a bare percent as Review', () => {
		const f = numberWordsPostCheck()('Rents rose twelve percent');
		expect(f).toHaveLength(2);
		for (const x of f) {
			expect(x.severity).toBe('warn');
			expect(x.members[0]!.categoryLabel).toBe('Number written as a word');
			expect(x.members[0]!.explanation).toBe(
				'Write numbers as digits so Tran can check them against what you entered.'
			);
		}
		expect(f.map((x) => x.phrase)).toEqual(['twelve', 'percent']);
	});

	it('ignores small number words and digits', () => {
		expect(numberWordsPostCheck()('Two bedrooms and 12% more light.')).toEqual([]);
	});
});

describe('unsupportedFeaturePostCheck', () => {
	it('flags a feature that is not in the facts as Review', () => {
		const text = 'A fireplace warms the living room.';
		const f = unsupportedFeaturePostCheck(facts())(text);
		expect(f).toHaveLength(1);
		expect(f[0]!.severity).toBe('warn');
		const m = f[0]!.members[0]!;
		expect(m.categoryLabel).toBe('Not in your facts');
		expect(m.explanation).toContain('"fireplace"');
		expect(m.explanation).toBe(
			'This mentions "fireplace", which isn\'t in your facts. Remove it, or add it to your facts if the home has it.'
		);
		expect(m.alternative).toBe('');
	});

	it('passes features backed by a chip or the agent free text', () => {
		const check = unsupportedFeaturePostCheck(
			facts({ features: ['Fireplace'], otherFeatures: '2 skylights' })
		);
		expect(check('A fireplace and 2 skylights.')).toEqual([]);
	});

	it('treats garage spaces as the Garage fact', () => {
		expect(unsupportedFeaturePostCheck(facts({ garageSpaces: 2 }))('A 2-car garage.')).toEqual([]);
		expect(unsupportedFeaturePostCheck(facts())('A 2-car garage.')).toHaveLength(1);
	});
});

describe('allowed sets', () => {
	it('listing: typed numbers plus numbers in free text', () => {
		const allowed = listingAllowedNumbers(
			facts({
				bedrooms: 3,
				bathrooms: 2.5,
				squareFeet: 1450,
				yearBuilt: 1987,
				otherFeatures: '2 skylights'
			})
		);
		for (const n of [3, 2.5, 1450, 1987, 2]) expect(allowed).toContain(n);
	});

	it('brief and reel: numerals in the agent text only', () => {
		expect(
			briefAllowedNumbers('Just listed: 4 bedrooms for $650,000', 'https://x.test/p/12')
		).toEqual([4, 12, 650000]);
		expect(reelAllowedNumbers({ results: 'Closed 9 homes', hook: 'In 30 days' })).toEqual([9, 30]);
	});
});
