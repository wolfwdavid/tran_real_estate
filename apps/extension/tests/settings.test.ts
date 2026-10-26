import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { enabledSetting } from '../src/lib/settings';

describe('enabledSetting', () => {
	beforeEach(() => {
		fakeBrowser.reset();
	});

	test('defaults to true on empty storage', async () => {
		expect(await enabledSetting.getValue()).toBe(true);
	});

	test('persists under chrome.storage.local key "enabled"', async () => {
		await enabledSetting.setValue(false);
		expect(await fakeBrowser.storage.local.get('enabled')).toEqual({ enabled: false });
		expect(await enabledSetting.getValue()).toBe(false);
	});

	test('watch receives the new value', async () => {
		const seen = vi.fn();
		const unwatch = enabledSetting.watch(seen);
		await enabledSetting.setValue(false);
		await vi.waitFor(() => expect(seen).toHaveBeenCalled());
		expect(seen.mock.calls[0]?.[0]).toBe(false);
		unwatch();
	});
});
