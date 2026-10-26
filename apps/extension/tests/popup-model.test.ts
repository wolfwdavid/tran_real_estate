import { describe, expect, test, vi } from 'vitest';
import { COPY } from '../src/lib/copy';
import { COUNT_PUSH, GET_COUNT, type CountPush, type CountResponse } from '../src/lib/messages';
import {
	applyPush,
	countLabel,
	isZillowUrl,
	loadStatus,
	stateCopy,
	type ActiveTab,
	type PopupDeps,
	type PopupState
} from '../src/lib/popup-model';

interface FakeOptions {
	enabled?: boolean | Error;
	tab?: ActiveTab | undefined;
	response?: CountResponse | Error;
}

function fakeDeps(opts: FakeOptions = {}) {
	const { enabled = true, response = { enabled: true, count: 0 } } = opts;
	const tab = 'tab' in opts ? opts.tab : { id: 7, url: 'https://www.zillow.com/homes/' };
	return {
		readEnabled: vi.fn(() =>
			enabled instanceof Error ? Promise.reject(enabled) : Promise.resolve(enabled)
		),
		writeEnabled: vi.fn(() => Promise.resolve()),
		activeTab: vi.fn(() => Promise.resolve(tab)),
		sendToTab: vi.fn(() =>
			response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
		),
		onCountPush: vi.fn(() => () => {})
	} satisfies PopupDeps;
}

const push = (enabled: boolean, count: number): CountPush => ({ type: COUNT_PUSH, enabled, count });

describe('isZillowUrl', () => {
	test.each([
		['https://www.zillow.com/homes/', true],
		['https://zillow.com/', true],
		['http://www.zillow.com/x', true],
		['https://notzillow.com/', false],
		['https://zillow.com.evil.test/', false],
		['chrome://extensions', false],
		['ftp://www.zillow.com/', false],
		['not a url', false],
		['', false]
	])('%s -> %s', (url, expected) => {
		expect(isZillowUrl(url)).toBe(expected);
	});

	test('undefined is not Zillow', () => {
		expect(isZillowUrl(undefined)).toBe(false);
	});
});

describe('loadStatus', () => {
	test('storage read rejects -> storage-error, no message sent', async () => {
		const deps = fakeDeps({ enabled: new Error('quota') });
		const status = await loadStatus(deps);
		expect(status).toEqual({ enabled: null, tabId: undefined, state: { kind: 'storage-error' } });
		expect(deps.sendToTab).not.toHaveBeenCalled();
	});

	test('filter off -> off, even on a non-Zillow tab, no message sent', async () => {
		const deps = fakeDeps({ enabled: false, tab: { id: 3, url: 'https://example.test/' } });
		const status = await loadStatus(deps);
		expect(status.enabled).toBe(false);
		expect(status.state).toEqual({ kind: 'off' });
		expect(deps.sendToTab).not.toHaveBeenCalled();
	});

	test('filter off on a Zillow tab -> off, no message sent', async () => {
		const deps = fakeDeps({ enabled: false });
		expect((await loadStatus(deps)).state).toEqual({ kind: 'off' });
		expect(deps.sendToTab).not.toHaveBeenCalled();
	});

	test('non-Zillow tab -> not-zillow', async () => {
		const deps = fakeDeps({ tab: { id: 3, url: 'https://example.test/' } });
		const status = await loadStatus(deps);
		expect(status).toEqual({ enabled: true, tabId: 3, state: { kind: 'not-zillow' } });
		expect(deps.sendToTab).not.toHaveBeenCalled();
	});

	test('withheld URL -> not-zillow', async () => {
		const deps = fakeDeps({ tab: { id: 3 } });
		expect((await loadStatus(deps)).state).toEqual({ kind: 'not-zillow' });
		expect(deps.sendToTab).not.toHaveBeenCalled();
	});

	test('no active tab -> not-zillow', async () => {
		const deps = fakeDeps({ tab: undefined });
		expect((await loadStatus(deps)).state).toEqual({ kind: 'not-zillow' });
	});

	test('activeTab rejects -> not-zillow', async () => {
		const deps = fakeDeps();
		deps.activeTab.mockImplementation(() => Promise.reject(new Error('no window')));
		expect((await loadStatus(deps)).state).toEqual({ kind: 'not-zillow' });
	});

	test('Zillow tab without an id -> not-running, no message sent', async () => {
		const deps = fakeDeps({ tab: { url: 'https://www.zillow.com/homes/' } });
		expect((await loadStatus(deps)).state).toEqual({ kind: 'not-running' });
		expect(deps.sendToTab).not.toHaveBeenCalled();
	});

	test('Zillow tab, sendToTab rejects -> not-running', async () => {
		const deps = fakeDeps({ response: new Error('Could not establish connection') });
		const status = await loadStatus(deps);
		expect(status).toEqual({ enabled: true, tabId: 7, state: { kind: 'not-running' } });
	});

	test('Zillow tab, count 0 -> zero; sends exactly GET_COUNT to the active tab', async () => {
		const deps = fakeDeps({ response: { enabled: true, count: 0 } });
		const status = await loadStatus(deps);
		expect(status.state).toEqual({ kind: 'zero' });
		expect(deps.sendToTab).toHaveBeenCalledTimes(1);
		expect(deps.sendToTab).toHaveBeenCalledWith(7, { type: GET_COUNT });
		expect((deps.sendToTab.mock.calls[0] as unknown[])[1]).toStrictEqual({
			type: 'tran-slf:get-count'
		});
	});

	test('Zillow tab, count 3 -> counting 3', async () => {
		const deps = fakeDeps({ response: { enabled: true, count: 3 } });
		expect((await loadStatus(deps)).state).toEqual({ kind: 'counting', count: 3 });
	});

	test('content script reports disabled -> off', async () => {
		const deps = fakeDeps({ response: { enabled: false, count: 0 } });
		expect((await loadStatus(deps)).state).toEqual({ kind: 'off' });
	});

	test('malformed response -> not-running', async () => {
		const deps = fakeDeps({ response: { enabled: true, count: -1 } });
		expect((await loadStatus(deps)).state).toEqual({ kind: 'not-running' });
	});
});

describe('applyPush', () => {
	const counting: PopupState = { kind: 'counting', count: 2 };

	test('ignores pushes from other tabs', () => {
		expect(applyPush(counting, push(true, 9), 7, 8)).toBe(counting);
	});

	test('ignores pushes with no sender tab', () => {
		expect(applyPush(counting, push(true, 9), 7, undefined)).toBe(counting);
	});

	test('ignores pushes when the active tab is unknown', () => {
		expect(applyPush(counting, push(true, 9), undefined, undefined)).toBe(counting);
	});

	test('enabled false -> off', () => {
		expect(applyPush(counting, push(false, 0), 7, 7)).toEqual({ kind: 'off' });
	});

	test('count 0 -> zero', () => {
		expect(applyPush(counting, push(true, 0), 7, 7)).toEqual({ kind: 'zero' });
	});

	test('count 5 -> counting 5', () => {
		expect(applyPush({ kind: 'zero' }, push(true, 5), 7, 7)).toEqual({
			kind: 'counting',
			count: 5
		});
	});

	test('a push recovers not-running and loading', () => {
		expect(applyPush({ kind: 'not-running' }, push(true, 1), 7, 7)).toEqual({
			kind: 'counting',
			count: 1
		});
		expect(applyPush({ kind: 'loading' }, push(true, 0), 7, 7)).toEqual({ kind: 'zero' });
	});

	test('does not override not-zillow or storage-error', () => {
		const notZillow: PopupState = { kind: 'not-zillow' };
		const storageError: PopupState = { kind: 'storage-error' };
		expect(applyPush(notZillow, push(true, 4), 7, 7)).toBe(notZillow);
		expect(applyPush(storageError, push(true, 4), 7, 7)).toBe(storageError);
	});
});

describe('countLabel', () => {
	test('singular and plural via Intl.PluralRules', () => {
		expect(countLabel(1)).toBe('sponsored card dimmed on this page');
		expect(countLabel(2)).toBe('sponsored cards dimmed on this page');
		expect(countLabel(24)).toBe(COPY.countOther);
		expect(countLabel(1)).toBe(COPY.countOne);
	});
});

describe('stateCopy', () => {
	test('maps every text-only state to its exact copy', () => {
		expect(stateCopy({ kind: 'zero' })).toBe(COPY.zero);
		expect(stateCopy({ kind: 'off' })).toBe(COPY.off);
		expect(stateCopy({ kind: 'not-zillow' })).toBe(COPY.notZillow);
		expect(stateCopy({ kind: 'not-running' })).toBe(COPY.notRunning);
		expect(stateCopy({ kind: 'storage-error' })).toBe(COPY.storageError);
	});

	test('loading is empty; counting is its label', () => {
		expect(stateCopy({ kind: 'loading' })).toBe('');
		expect(stateCopy({ kind: 'counting', count: 1 })).toBe(COPY.countOne);
		expect(stateCopy({ kind: 'counting', count: 3 })).toBe(COPY.countOther);
	});
});
