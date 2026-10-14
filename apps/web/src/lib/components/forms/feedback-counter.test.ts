import { describe, expect, test } from 'vitest';
import { MAX_FEEDBACK, counterText, crossedThreshold, topicFromSearch } from './feedback-counter';

describe('counterText', () => {
	test('MAX_FEEDBACK is 2,000 characters', () => {
		expect(MAX_FEEDBACK).toBe(2000);
	});

	test('shows "{n} of 2,000 characters" while more than 100 remain', () => {
		expect(counterText(0)).toBe('0 of 2,000 characters');
		expect(counterText(1)).toBe('1 of 2,000 characters');
		expect(counterText(1899)).toBe('1,899 of 2,000 characters');
	});

	test('switches to "{r} characters left" at 100 or fewer remaining', () => {
		expect(counterText(1900)).toBe('100 characters left');
		expect(counterText(1950)).toBe('50 characters left');
		expect(counterText(2000)).toBe('0 characters left');
	});

	test('uses the singular for one character left', () => {
		expect(counterText(1999)).toBe('1 character left');
	});

	test('never shows a negative remainder', () => {
		expect(counterText(2100)).toBe('0 characters left');
	});
});

describe('crossedThreshold', () => {
	test('fires only when moving into 100 or fewer remaining', () => {
		expect(crossedThreshold(1899, 1900)).toBe(true);
		expect(crossedThreshold(0, 2000)).toBe(true);
	});

	test('does not fire while already inside, or when moving back out', () => {
		expect(crossedThreshold(1900, 1950)).toBe(false);
		expect(crossedThreshold(1950, 1899)).toBe(false);
		expect(crossedThreshold(10, 20)).toBe(false);
	});
});

describe('topicFromSearch', () => {
	test('maps a known ?portal= to its topic', () => {
		expect(topicFromSearch('?portal=renter')).toBe('renter');
		expect(topicFromSearch('?portal=investor')).toBe('investor');
		expect(topicFromSearch('?portal=agent')).toBe('agent');
		expect(topicFromSearch('?portal=tools')).toBe('tools');
	});

	test('falls back to "other" for an unknown or missing value', () => {
		expect(topicFromSearch('?portal=x')).toBe('other');
		expect(topicFromSearch('?portal=other')).toBe('other');
		expect(topicFromSearch('?portal=')).toBe('other');
		expect(topicFromSearch('')).toBe('other');
		expect(topicFromSearch('?topic=renter')).toBe('other');
	});
});
