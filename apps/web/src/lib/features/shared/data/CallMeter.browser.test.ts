import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import CallMeter from './CallMeter.svelte';

const NOV_1 = Date.parse('2026-11-01T00:00:00Z');

type Variant = 'full' | 'compact';
const props = (used: number, cap: number, variant: Variant, unbilled = 0) => ({
	used,
	unbilled,
	cap,
	resetsAt: NOV_1,
	variant,
	id: `meter-${variant}`
});

const CASES = [
	{ name: 'ok', used: 12, cap: 40, fill: 'bg-secondary', icon: 'gauge' },
	{ name: 'near', used: 35, cap: 40, fill: 'bg-primary', icon: 'circle-alert' },
	{ name: 'at', used: 40, cap: 40, fill: 'bg-primary', icon: 'circle-pause' },
	{ name: 'past', used: 52, cap: 60, fill: 'bg-destructive', icon: 'circle-alert' }
] as const;

const fillOf = (container: HTMLElement) =>
	container.querySelector<HTMLElement>('[data-testid="meter-fill"]')!;

describe('CallMeter full', () => {
	test('group is named by the headline; bar is decorative', async () => {
		const { container } = await render(CallMeter, { props: props(12, 40, 'full') });
		const group = container.querySelector('[role="group"]')!;
		expect(group.getAttribute('aria-labelledby')).toBe('meter-full-headline');
		expect(container.querySelector('#meter-full-headline')!.textContent!.trim()).toBe(
			'12 of 50 calls used this month'
		);
		await expect
			.element(page.getByRole('group', { name: '12 of 50 calls used this month' }))
			.toBeVisible();
		const bar = fillOf(container).closest('[aria-hidden="true"]');
		expect(bar).not.toBeNull();
		expect(bar!.textContent).toContain('Cap 40');
	});

	test('ok: sub-line, scope note, gauge icon, no state line, no not-counted line', async () => {
		const { container } = await render(CallMeter, { props: props(12, 40, 'full') });
		const text = container.textContent!;
		expect(text).toContain('Cap: 40 · 28 left before your cap · Resets Nov 1 (UTC)');
		expect(text).toContain(
			"This counts calls made from this browser. Calls from other devices or the RentCast dashboard aren't included, and RentCast's own billing cycle may start on a different day. Your RentCast dashboard has the official count."
		);
		expect(text).not.toContain('Not counted');
		expect(text).not.toContain('Free plan: 50');
		expect(container.querySelector('svg[data-icon="gauge"]')).not.toBeNull();
	});

	test('near shows the state line', async () => {
		const { container } = await render(CallMeter, { props: props(35, 40, 'full') });
		expect(container.textContent).toContain('5 calls left before your cap.');
		expect(container.querySelector('svg[data-icon="circle-alert"]')).not.toBeNull();
	});

	test('at shows the at-cap line', async () => {
		const { container } = await render(CallMeter, { props: props(40, 40, 'full') });
		expect(container.textContent).toContain(
			"You've reached your cap. Tran asks before each extra call."
		);
		expect(container.querySelector('svg[data-icon="circle-pause"]')).not.toBeNull();
	});

	test('past takes priority while cap is above 50, with a free-plan marker', async () => {
		const { container } = await render(CallMeter, { props: props(52, 60, 'full') });
		const text = container.textContent!;
		expect(text).toContain(
			"You're past the 50 calls in RentCast's free plan. If your RentCast account has a card on file, RentCast bills each extra call at $0.20, charged to your card."
		);
		expect(text).toContain('Cap 60');
		expect(text).toContain('Free plan: 50');
		expect(fillOf(container).className).toContain('bg-destructive');
	});

	test('not-counted line appears only when unbilled > 0', async () => {
		const { container } = await render(CallMeter, { props: props(12, 40, 'full', 3) });
		expect(container.textContent).toContain(
			'Not counted: 3 searches with no results. RentCast bills only requests that return data.'
		);
	});
});

describe('CallMeter compact', () => {
	test('headline, cap text, link, no captions', async () => {
		const { container } = await render(CallMeter, { props: props(12, 40, 'compact') });
		expect(container.querySelector('#meter-compact-headline')!.textContent!.trim()).toBe(
			'RentCast calls: 12 of 50 this month'
		);
		await expect
			.element(page.getByRole('group', { name: 'RentCast calls: 12 of 50 this month' }))
			.toBeVisible();
		const bar = fillOf(container).closest('[aria-hidden="true"]')!;
		expect(bar.textContent!.trim()).toBe('');
		expect(container.textContent).toContain('Cap 40');
		expect(container.textContent).not.toContain('Free plan: 50');
		const link = page.getByRole('link', { name: 'Usage and cap' });
		await expect.element(link).toHaveAttribute('href', '/settings/#rentcast-usage');
	});

	test.each([
		[37, 40, '3 left'],
		[40, 40, 'Cap reached'],
		[52, 60, 'Past free 50']
	])('state word for used %i cap %i', async (used, cap, word) => {
		const { container } = await render(CallMeter, { props: props(used, cap, 'compact') });
		expect(container.textContent).toContain(word);
	});
});

describe('CallMeter bar', () => {
	test.each(CASES)('$name: fill colour, width and icon', async ({ used, cap, fill, icon }) => {
		for (const variant of ['full', 'compact'] as const) {
			const { container, unmount } = await render(CallMeter, {
				props: props(used, cap, variant)
			});
			const el = fillOf(container);
			expect(el.className).toContain(fill);
			expect(el.className).not.toMatch(/transition/);
			const scale = Math.max(50, cap, used);
			expect(el.style.width).toMatch(/%$/);
			expect(parseFloat(el.style.width)).toBeCloseTo((used / scale) * 100, 3);
			expect(container.querySelector(`svg[data-icon="${icon}"]`)).not.toBeNull();
			unmount();
		}
	});

	test.each(CASES)('$name: no axe violations in either variant', async ({ used, cap }) => {
		for (const variant of ['full', 'compact'] as const) {
			const { container, unmount } = await render(CallMeter, {
				props: props(used, cap, variant)
			});
			expect(await axeViolations(container)).toEqual([]);
			unmount();
		}
	});
});
