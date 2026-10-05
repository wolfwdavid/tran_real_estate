import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { KeyTestOutcome } from '@tran/core/request';
import { axeViolations } from '$lib/testing/axe';
import KeyTestResult from './KeyTestResult.svelte';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const TWO_HOURS_AGO = NOW - 2 * 60 * 60 * 1000;

const CASES: { outcome: KeyTestOutcome; icon: string; color: string; line: string }[] = [
	{
		outcome: 'valid',
		icon: 'circle-check',
		color: 'text-secondary',
		line: "RentCast accepted this key. The test didn't use a call."
	},
	{
		outcome: 'valid-billed',
		icon: 'circle-check',
		color: 'text-secondary',
		line: 'RentCast accepted this key. The test returned data, so it counted as 1 call.'
	},
	{
		outcome: 'invalid',
		icon: 'circle-alert',
		color: 'text-destructive',
		line: "RentCast didn't accept this key. Check that you copied all of it, or create a new key."
	},
	{
		outcome: 'restricted',
		icon: 'shield-alert',
		color: 'text-foreground',
		line: 'RentCast recognized this key but refused the test request. If you limited the key to certain endpoints, make sure it allows rental listings, sale listings, estimates, and market data. Otherwise, check your account at RentCast.'
	},
	{
		outcome: 'unverified',
		icon: 'circle-question-mark',
		color: 'text-muted-foreground',
		line: "Couldn't check this key, because api.rentcast.io didn't respond. Check your connection, then try again. Your key is still saved."
	},
	{
		outcome: 'rate-limited',
		icon: 'hourglass',
		color: 'text-foreground',
		line: 'RentCast is limiting requests right now. Wait a minute, then try again.'
	}
];

describe('KeyTestResult', () => {
	test('renders nothing without a result', async () => {
		const { container } = await render(KeyTestResult, { props: { result: null, now: NOW } });
		expect(container.textContent!.trim()).toBe('');
		expect(container.querySelector('svg')).toBeNull();
	});

	test.each(CASES)(
		'$outcome: icon, line and tested line',
		async ({ outcome, icon, color, line }) => {
			const { container } = await render(KeyTestResult, {
				props: { result: { outcome, at: TWO_HOURS_AGO }, now: NOW }
			});
			const svg = container.querySelector<SVGElement>(`svg[data-icon="${icon}"]`);
			expect(svg).not.toBeNull();
			expect(svg!.getAttribute('aria-hidden')).toBe('true');
			expect(svg!.getAttribute('class')).toContain(color);
			const text = container.textContent!.replace(/\s+/g, ' ');
			expect(text).toContain(line);
			expect(text).toContain('Tested 2 hours ago');
			// Plain text: the caller owns the announcement.
			expect(container.querySelector('[aria-live]')).toBeNull();
			expect(container.querySelector('[role="status"],[role="alert"]')).toBeNull();
			expect(await axeViolations(container)).toEqual([]);
		}
	);

	test('unverified wraps the host in <code>', async () => {
		const { container } = await render(KeyTestResult, {
			props: { result: { outcome: 'unverified', at: TWO_HOURS_AGO }, now: NOW }
		});
		const code = container.querySelector('code');
		expect(code).not.toBeNull();
		expect(code!.textContent).toBe('api.rentcast.io');
	});

	test('tested line uses <time> with the ISO instant', async () => {
		const { container } = await render(KeyTestResult, {
			props: { result: { outcome: 'valid', at: TWO_HOURS_AGO }, now: NOW }
		});
		const time = container.querySelector('time');
		expect(time).not.toBeNull();
		expect(time!.getAttribute('datetime')).toBe(new Date(TWO_HOURS_AGO).toISOString());
	});

	test.each([
		['empty', 'Paste a key before saving.'],
		[
			'whitespace',
			'This key has spaces or line breaks in it. Copy it again from RentCast and paste it here.'
		],
		[
			'length',
			"This doesn't look like a complete RentCast key. Copy it again from RentCast and paste it here."
		]
	] as const)('bad-format %s: field-style message, no tested line', async (formatError, line) => {
		const { container } = await render(KeyTestResult, {
			props: { result: { outcome: 'bad-format', formatError, at: TWO_HOURS_AGO }, now: NOW }
		});
		const text = container.textContent!;
		expect(text).toContain(line);
		expect(text).not.toContain('Tested');
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('aria-hidden')).toBe('true');
		expect(await axeViolations(container)).toEqual([]);
	});
});
