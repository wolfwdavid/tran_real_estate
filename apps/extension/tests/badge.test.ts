import { describe, expect, it, vi } from 'vitest';
import { applyBadge, BADGE_BG, BADGE_FG, initBadgeColors, type BadgeApi } from '../src/lib/badge';
import { COUNT_PUSH } from '../src/lib/messages';

function fakeApi(withTextColor = true) {
	const api = {
		setBadgeText: vi.fn(),
		setTitle: vi.fn(),
		setBadgeBackgroundColor: vi.fn(),
		...(withTextColor ? { setBadgeTextColor: vi.fn() } : {})
	};
	return api as typeof api & BadgeApi;
}

describe('applyBadge', () => {
	it('shows the count and the count tooltip for the sending tab', () => {
		const api = fakeApi();
		applyBadge(api, 7, { type: COUNT_PUSH, enabled: true, count: 3 });
		expect(api.setBadgeText).toHaveBeenCalledWith({ tabId: 7, text: '3' });
		expect(api.setTitle).toHaveBeenCalledWith({
			tabId: 7,
			title: 'Sponsored Listing Filter: 3 dimmed on this page'
		});
	});

	it.each([
		[true, 0, ''],
		[true, 99, '99'],
		[true, 100, '99+'],
		[true, 150, '99+'],
		[false, 5, '']
	])('enabled=%s count=%i shows %j', (enabled, count, text) => {
		const api = fakeApi();
		applyBadge(api, 2, { type: COUNT_PUSH, enabled, count });
		expect(api.setBadgeText).toHaveBeenCalledWith({ tabId: 2, text });
	});

	it('uses the off tooltip when the filter is off', () => {
		const api = fakeApi();
		applyBadge(api, 4, { type: COUNT_PUSH, enabled: false, count: 9 });
		expect(api.setTitle).toHaveBeenCalledWith({ tabId: 4, title: 'Sponsored Listing Filter: off' });
	});

	it('swallows rejections from the badge API (tab closed mid-update)', async () => {
		const api = fakeApi();
		api.setBadgeText.mockRejectedValue(new Error('No tab with id: 9'));
		api.setTitle.mockRejectedValue(new Error('No tab with id: 9'));
		const unhandled = vi.fn();
		process.on('unhandledRejection', unhandled);
		applyBadge(api, 9, { type: COUNT_PUSH, enabled: true, count: 1 });
		await new Promise((r) => setTimeout(r, 0));
		process.off('unhandledRejection', unhandled);
		expect(unhandled).not.toHaveBeenCalled();
	});
});

describe('initBadgeColors', () => {
	it('sets espresso background and ivory text', () => {
		const api = fakeApi();
		initBadgeColors(api);
		expect(BADGE_BG).toBe('#2b1d16');
		expect(BADGE_FG).toBe('#fbf7f0');
		expect(api.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#2b1d16' });
		expect(api.setBadgeTextColor).toHaveBeenCalledWith({ color: '#fbf7f0' });
	});

	it('skips the text colour where the API lacks it', () => {
		const api = fakeApi(false);
		expect(() => initBadgeColors(api)).not.toThrow();
		expect(api.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#2b1d16' });
	});
});
