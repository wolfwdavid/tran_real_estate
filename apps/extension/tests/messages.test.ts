import { describe, expect, test, vi } from 'vitest';
import { COPY, badgeTitleCount } from '../src/lib/copy';
import {
	COUNT_PUSH,
	GET_COUNT,
	badgeFor,
	createResponder,
	isCountPush,
	isGetCount
} from '../src/lib/messages';

describe('message names', () => {
	test('are namespaced', () => {
		expect(GET_COUNT).toBe('tran-slf:get-count');
		expect(COUNT_PUSH).toBe('tran-slf:count');
	});
});

describe('isGetCount', () => {
	test('accepts only the get-count message', () => {
		expect(isGetCount({ type: GET_COUNT })).toBe(true);
		expect(isGetCount({ type: COUNT_PUSH })).toBe(false);
		expect(isGetCount({ type: 'other' })).toBe(false);
		expect(isGetCount(null)).toBe(false);
		expect(isGetCount('tran-slf:get-count')).toBe(false);
	});
});

describe('isCountPush', () => {
	test('accepts a well-formed push', () => {
		expect(isCountPush({ type: COUNT_PUSH, enabled: true, count: 3 })).toBe(true);
		expect(isCountPush({ type: COUNT_PUSH, enabled: false, count: 0 })).toBe(true);
	});

	test('rejects wrong type, non-boolean enabled and bad counts', () => {
		expect(isCountPush({ type: GET_COUNT, enabled: true, count: 3 })).toBe(false);
		expect(isCountPush({ type: COUNT_PUSH, enabled: 'yes', count: 3 })).toBe(false);
		expect(isCountPush({ type: COUNT_PUSH, enabled: true, count: -1 })).toBe(false);
		expect(isCountPush({ type: COUNT_PUSH, enabled: true, count: 1.5 })).toBe(false);
		expect(isCountPush({ type: COUNT_PUSH, enabled: true, count: Number.NaN })).toBe(false);
		expect(isCountPush({ type: COUNT_PUSH, enabled: true })).toBe(false);
		expect(isCountPush(undefined)).toBe(false);
	});
});

describe('createResponder', () => {
	test('answers get-count through sendResponse and returns true', () => {
		const respond = createResponder(() => ({ enabled: true, count: 3 }));
		const sendResponse = vi.fn();
		expect(respond({ type: GET_COUNT }, {}, sendResponse)).toBe(true);
		expect(sendResponse).toHaveBeenCalledExactlyOnceWith({ enabled: true, count: 3 });
	});

	test('ignores other messages', () => {
		const getStatus = vi.fn(() => ({ enabled: true, count: 3 }));
		const respond = createResponder(getStatus);
		const sendResponse = vi.fn();
		expect(respond({ type: 'other' }, {}, sendResponse)).toBeUndefined();
		expect(sendResponse).not.toHaveBeenCalled();
		expect(getStatus).not.toHaveBeenCalled();
	});
});

describe('badgeFor', () => {
	test('zero shows no text and the count title', () => {
		expect(badgeFor({ enabled: true, count: 0 })).toEqual({
			text: '',
			title: 'Sponsored Listing Filter: 0 dimmed on this page'
		});
	});

	test.each([
		[1, '1'],
		[99, '99'],
		[100, '99+'],
		[250, '99+']
	])('count %i -> %j', (count, text) => {
		expect(badgeFor({ enabled: true, count })).toEqual({ text, title: badgeTitleCount(count) });
	});

	test('off shows no text and the off title regardless of count', () => {
		expect(badgeFor({ enabled: false, count: 5 })).toEqual({
			text: '',
			title: 'Sponsored Listing Filter: off'
		});
	});
});

describe('COPY', () => {
	test('manifest description fits the 132-character store limit', () => {
		expect(COPY.description.length).toBeLessThanOrEqual(132);
	});

	test('is frozen', () => {
		expect(Object.isFrozen(COPY)).toBe(true);
	});
});
