import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { GatewayError as GatewayErr, type GatewayErrorInfo } from '@tran/core/request';
import { announce } from '$lib/components/a11y/announcer.svelte';
import { axeViolations } from '$lib/testing/axe';
import GatewayError from './GatewayError.svelte';

// Spy on the real announcer (the component reaches it through platform-ui).
vi.mock('$lib/components/a11y/announcer.svelte', { spy: true });

const NOV_1 = Date.parse('2026-11-01T00:00:00Z');
const err = (info: GatewayErrorInfo) => new GatewayErr(info);

type Action = { role: 'link' | 'button'; name: string; href?: string };

const SETTINGS_KEY: Action = {
	role: 'link',
	name: 'Check your key in Settings',
	href: '/settings/#api-keys'
};
const USE_SAMPLE: Action = { role: 'button', name: 'Use sample data instead' };
const TRY_AGAIN: Action = { role: 'button', name: 'Try again (1 call)' };

const VARIANTS: Array<{
	label: string;
	info: GatewayErrorInfo;
	title: string;
	body: string;
	icon: string;
	actions: Action[];
}> = [
	{
		label: 'InvalidKey',
		info: { kind: 'InvalidKey' },
		title: "RentCast didn't accept your key",
		body: 'Check that you copied the whole key in Settings, or create a new one at RentCast. No call was counted.',
		icon: 'key-round',
		actions: [SETTINGS_KEY, USE_SAMPLE]
	},
	{
		label: 'RestrictedKey',
		info: { kind: 'RestrictedKey', detail: 'restriction' },
		title: "Your RentCast key can't make this request",
		body: "RentCast recognized the key but refused this request. The key may be limited to other endpoints, or your RentCast account may need attention. Check the key's settings in your RentCast dashboard. No call was counted.",
		icon: 'shield-alert',
		actions: [
			SETTINGS_KEY,
			{
				role: 'link',
				name: 'Open RentCast dashboard (opens external site)',
				href: 'https://app.rentcast.io/app/api'
			}
		]
	},
	{
		label: 'RateLimited',
		info: { kind: 'RateLimited', retryInMs: 0 },
		title: 'RentCast is busy right now',
		body: 'Too many requests reached RentCast at once. Wait a few seconds, then try again. No call was counted.',
		icon: 'hourglass',
		actions: [TRY_AGAIN]
	},
	{
		label: 'BudgetCapReached',
		info: { kind: 'BudgetCapReached', used: 40, cap: 40, resetsAt: NOV_1 },
		title: 'Stopped at your monthly cap',
		body: "You've used 40 of your 40-call cap this month, so nothing was spent. Your count resets on Nov 1 (UTC). You can continue for this one call, raise your cap, or keep browsing saved results.",
		icon: 'circle-pause',
		actions: [
			{ role: 'button', name: 'Continue past cap…' },
			{ role: 'link', name: 'Change your cap', href: '/settings/#rentcast-usage' }
		]
	},
	{
		label: 'NoResults',
		info: { kind: 'NoResults' },
		title: 'No results for this search',
		body: "RentCast has nothing that matches right now. Try a nearby ZIP code, a wider price range, or fewer filters. This answer is saved for 24 hours, so repeating the same search won't use a call.",
		icon: 'search-x',
		actions: [{ role: 'button', name: 'Edit search' }]
	},
	{
		label: 'NetworkError',
		info: { kind: 'NetworkError' },
		title: "Couldn't reach RentCast",
		body: "Check your connection, then try again. Tran didn't count a call for this.",
		icon: 'wifi-off',
		actions: [TRY_AGAIN]
	},
	{
		label: 'NetworkError 5xx',
		info: { kind: 'NetworkError', detail: 'server' },
		title: 'RentCast had a problem answering',
		body: "This is on RentCast's side. Try again in a few minutes. Tran didn't count a call for this.",
		icon: 'circle-alert',
		actions: [TRY_AGAIN]
	},
	{
		label: 'SchemaMismatch',
		info: { kind: 'SchemaMismatch' },
		title: "RentCast sent data Tran couldn't read",
		body: 'RentCast may have changed the format of its results. This call was counted, because RentCast answered. Nothing was saved. Use sample data for now, and try again later.',
		icon: 'triangle-alert',
		actions: [USE_SAMPLE]
	}
];

const accessibleName = (el: Element) =>
	(el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();

afterEach(() => {
	vi.mocked(announce).mockClear();
});

describe('GatewayError variants', () => {
	test.each(VARIANTS)('$label: title, body, icon and actions', async (v) => {
		const { container } = await render(GatewayError, { props: { error: err(v.info) } });
		const title = container.querySelector('[tabindex="-1"]')!;
		expect(title.textContent!.trim()).toBe(v.title);
		expect(container.querySelector('[data-testid="gateway-error-body"]')!.textContent!.trim()).toBe(
			v.body
		);
		expect(container.querySelector(`svg[data-icon="${v.icon}"]`)).not.toBeNull();

		const actions = [...container.querySelectorAll('[data-testid="gateway-error-actions"] > *')];
		expect(
			actions.map((a) => ({
				role: a.tagName === 'A' ? 'link' : 'button',
				name: accessibleName(a),
				...(a.tagName === 'A' ? { href: a.getAttribute('href') } : {})
			}))
		).toEqual(v.actions);
		for (const a of container.querySelectorAll('a')) {
			expect(a.hasAttribute('target')).toBe(false);
		}
		expect(container.querySelector('[role="alert"]')).toBeNull();
	});

	test.each(VARIANTS)('$label: panel treatment', async (v) => {
		const { container } = await render(GatewayError, { props: { error: err(v.info) } });
		const panel = container.querySelector('section')!;
		if (v.info.kind === 'NoResults') {
			expect(panel.className).toContain('bg-surface');
			expect(panel.className).not.toContain('border-l-4');
		} else {
			expect(panel.className).toContain('border-l-4');
			expect(panel.className).toContain('border-l-destructive');
			expect(panel.className).toContain('bg-card');
		}
	});

	test.each(VARIANTS)('$label: announced once as "{title}. {body}"', async (v) => {
		await render(GatewayError, { props: { error: err(v.info) } });
		expect(vi.mocked(announce)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(announce).mock.calls[0]![0]).toBe(`${v.title}. ${v.body}`);
	});

	test.each(VARIANTS)('$label: no axe violations', async (v) => {
		const { container } = await render(GatewayError, { props: { error: err(v.info) } });
		expect(await axeViolations(container)).toEqual([]);
	});
});

describe('GatewayError focus', () => {
	test('focusOnMount moves focus to the title', async () => {
		const { container } = await render(GatewayError, {
			props: { error: err({ kind: 'InvalidKey' }), focusOnMount: true }
		});
		expect(document.activeElement).toBe(container.querySelector('[tabindex="-1"]'));
	});

	test('without focusOnMount focus stays where it was', async () => {
		const before = document.activeElement;
		const { container } = await render(GatewayError, {
			props: { error: err({ kind: 'InvalidKey' }) }
		});
		expect(document.activeElement).toBe(before);
		expect(container.contains(document.activeElement)).toBe(false);
	});
});

describe('GatewayError actions', () => {
	test('handlers fire on click', async () => {
		const onUseSample = vi.fn();
		await render(GatewayError, {
			props: { error: err({ kind: 'SchemaMismatch' }), onUseSample }
		});
		await page.getByRole('button', { name: 'Use sample data instead' }).click();
		expect(onUseSample).toHaveBeenCalledOnce();
	});

	test('continue past cap and edit search', async () => {
		const onContinuePastCap = vi.fn();
		const onEditSearch = vi.fn();
		await render(GatewayError, {
			props: {
				error: err({ kind: 'BudgetCapReached', used: 40, cap: 40, resetsAt: NOV_1 }),
				onContinuePastCap
			}
		});
		await page.getByRole('button', { name: 'Continue past cap…' }).click();
		expect(onContinuePastCap).toHaveBeenCalledOnce();
		await render(GatewayError, { props: { error: err({ kind: 'NoResults' }), onEditSearch } });
		await page.getByRole('button', { name: 'Edit search' }).click();
		expect(onEditSearch).toHaveBeenCalledOnce();
	});
});

describe('GatewayError rate-limit countdown', () => {
	test('disabled countdown, start/end announcements, never auto-retries', async () => {
		const onTryAgain = vi.fn(async () => {});
		await render(GatewayError, {
			props: { error: err({ kind: 'RateLimited', retryInMs: 2000 }), onTryAgain }
		});
		const waiting = page.getByRole('button', { name: 'Try again in 2s' });
		await expect.element(waiting).toBeDisabled();
		expect(vi.mocked(announce)).toHaveBeenCalledWith(
			'RentCast is busy. You can try again in 2 seconds.'
		);
		expect(vi.mocked(announce)).not.toHaveBeenCalledWith('You can try again now.');

		const ready = page.getByRole('button', { name: 'Try again (1 call)' });
		await expect.element(ready, { timeout: 4000 }).toBeEnabled();
		expect(vi.mocked(announce)).toHaveBeenLastCalledWith('You can try again now.');
		// Only mount + start + end: the per-second ticks are never announced.
		expect(vi.mocked(announce)).toHaveBeenCalledTimes(3);
		expect(onTryAgain).not.toHaveBeenCalled();

		await ready.click();
		expect(onTryAgain).toHaveBeenCalledOnce();
	});

	test('the countdown text is not a live region', async () => {
		const { container } = await render(GatewayError, {
			props: { error: err({ kind: 'RateLimited', retryInMs: 2000 }) }
		});
		const button = container.querySelector('button')!;
		expect(button.getAttribute('aria-live')).toBe('off');
	});

	test('network retry calls onTryAgain on click', async () => {
		const onTryAgain = vi.fn(async () => {});
		await render(GatewayError, { props: { error: err({ kind: 'NetworkError' }), onTryAgain } });
		await page.getByRole('button', { name: 'Try again (1 call)' }).click();
		expect(onTryAgain).toHaveBeenCalledOnce();
	});
});
