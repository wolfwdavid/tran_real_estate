import { afterEach, describe, expect, it, vi } from 'vitest';
import { findBanned } from '../../../../../../scripts/lib/banned-terms-rules.mjs';

function fakeStorage() {
	const map = new Map<string, string>();
	return {
		map,
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k)
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe('onboarding-state', () => {
	it('importing the module touches no storage', async () => {
		vi.stubGlobal('localStorage', undefined);
		vi.resetModules();
		const mod = await import('./onboarding-state');
		expect(mod.ONBOARDING_KEY).toBe('tran.onboarding.v1');
		expect(mod.readOnboarding()).toEqual({ status: 'new' });
		expect(mod.writeOnboarding({ status: 'done' })).toBe(false);
	});

	it('parseOnboarding falls back to new on anything invalid', async () => {
		const { parseOnboarding } = await import('./onboarding-state');
		expect(parseOnboarding(null)).toEqual({ status: 'new' });
		expect(parseOnboarding('not json')).toEqual({ status: 'new' });
		expect(parseOnboarding('{"status":"weird"}')).toEqual({ status: 'new' });
		expect(parseOnboarding('{"status":"touring","step":9}')).toEqual({ status: 'new' });
		expect(parseOnboarding('null')).toEqual({ status: 'new' });
		expect(parseOnboarding('[1]')).toEqual({ status: 'new' });
	});

	it('parseOnboarding keeps whitelisted fields only', async () => {
		const { parseOnboarding } = await import('./onboarding-state');
		expect(parseOnboarding('{"status":"touring","portal":"agent","step":2}')).toEqual({
			status: 'touring',
			portal: 'agent',
			step: 2
		});
		expect(
			parseOnboarding('{"status":"done","lastPortal":"investor","extra":1,"portal":"landlord"}')
		).toEqual({ status: 'done', lastPortal: 'investor' });
	});

	it('readOnboarding handles empty, missing and throwing storage', async () => {
		const { readOnboarding } = await import('./onboarding-state');
		expect(readOnboarding(fakeStorage())).toEqual({ status: 'new' });
		expect(readOnboarding(undefined)).toEqual({ status: 'new' });
		const throwing = {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => undefined
		};
		expect(readOnboarding(throwing)).toEqual({ status: 'new' });
	});

	it('writeOnboarding stores exact JSON and swallows failures', async () => {
		const { writeOnboarding, readOnboarding } = await import('./onboarding-state');
		const s = fakeStorage();
		expect(writeOnboarding({ status: 'done', lastPortal: 'investor' }, s)).toBe(true);
		expect(s.map.get('tran.onboarding.v1')).toBe('{"status":"done","lastPortal":"investor"}');
		expect(readOnboarding(s)).toEqual({ status: 'done', lastPortal: 'investor' });
		const throwing = {
			getItem: () => null,
			setItem: () => {
				throw new Error('QuotaExceededError');
			}
		};
		expect(writeOnboarding({ status: 'hidden' }, throwing)).toBe(false);
	});
});

describe('onboarding copy', () => {
	it('contains no banned terms', async () => {
		const { ONBOARDING_COPY } = await import('$lib/content/onboarding');
		const rendered = JSON.stringify(ONBOARDING_COPY, (_k, v) =>
			typeof v === 'function' ? String(v('renter')) : v
		);
		expect(findBanned('onboarding', rendered)).toEqual([]);
	});
});
