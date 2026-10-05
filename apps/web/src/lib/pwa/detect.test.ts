import { describe, expect, it } from 'vitest';
import { isIos, isStandalone } from './detect';

const IPHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MAC_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const WINDOWS_CHROME_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

describe('isIos', () => {
	it('detects iPhone from the user agent', () => {
		expect(isIos({ userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5 })).toBe(true);
	});

	it('detects iPadOS, which reports a desktop Mac user agent but has touch points', () => {
		expect(isIos({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
	});

	it('does not treat a real Mac as iOS', () => {
		expect(isIos({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
		expect(isIos({ userAgent: MAC_UA, platform: 'MacIntel' })).toBe(false);
	});

	it('does not treat Windows Chrome as iOS', () => {
		expect(isIos({ userAgent: WINDOWS_CHROME_UA, platform: 'Win32', maxTouchPoints: 10 })).toBe(
			false
		);
	});
});

describe('isStandalone', () => {
	it('is true when the display-mode media query matches', () => {
		const queries: string[] = [];
		const win = {
			matchMedia: (q: string) => {
				queries.push(q);
				return { matches: true };
			},
			navigator: {}
		};
		expect(isStandalone(win)).toBe(true);
		expect(queries).toContain('(display-mode: standalone)');
	});

	it('is true when iOS reports navigator.standalone', () => {
		expect(
			isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })
		).toBe(true);
	});

	it('is false when neither signal is present', () => {
		expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false);
		expect(
			isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: false } })
		).toBe(false);
	});
});
