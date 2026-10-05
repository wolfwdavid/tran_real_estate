import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import NewSinceBadge from './NewSinceBadge.svelte';
import { toIso } from './relative-time';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const TWO_HOURS_AGO = NOW - 2 * 60 * 60 * 1000;

function norm(el: Element | null | undefined): string | undefined {
	return el?.textContent?.replace(/\s+/g, ' ').trim();
}

describe('NewSinceBadge', () => {
	test('new listings: count text, BellDot icon, terracotta tint, detail and checked lines', async () => {
		const { container } = await render(NewSinceBadge, {
			props: {
				newCount: 3,
				priceChanged: 1,
				gone: 0,
				checkedAt: TWO_HOURS_AGO,
				source: 'rentcast',
				now: NOW
			}
		});
		const badge = container.querySelector<HTMLElement>('[data-new-since]');
		expect(norm(badge)).toBe('3 new since your last visit');
		expect(badge?.classList).toContain('bg-accent-surface');
		expect(badge?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
		expect(norm(container.querySelector('[data-new-since-detail]'))).toBe('3 new, 1 price change');
		const checked = container.querySelector('[data-new-since-checked]');
		expect(norm(checked)).toBe('Checked 2 hours ago from RentCast');
		expect(checked?.querySelector('time')?.getAttribute('datetime')).toBe(toIso(TWO_HOURS_AGO));
		expect(await axeViolations(container)).toEqual([]);
	});

	test('nothing new: "No new listings" on the neutral surface with no icon', async () => {
		const { container } = await render(NewSinceBadge, {
			props: { newCount: 0, priceChanged: 0, gone: 0, checkedAt: NOW, source: 'sample', now: NOW }
		});
		const badge = container.querySelector<HTMLElement>('[data-new-since]');
		expect(norm(badge)).toBe('No new listings');
		expect(badge?.classList).toContain('bg-surface');
		expect(badge?.querySelector('svg')).toBeNull();
		expect(container.querySelector('[data-new-since-detail]')).toBeNull();
		expect(norm(container.querySelector('[data-new-since-checked]'))).toBe(
			'Checked just now (sample data)'
		);
		expect(await axeViolations(container)).toEqual([]);
	});

	test('singular new count and the never-checked state', async () => {
		const { container } = await render(NewSinceBadge, {
			props: {
				newCount: 1,
				priceChanged: 0,
				gone: 2,
				checkedAt: null,
				source: 'rentcast',
				now: NOW
			}
		});
		expect(norm(container.querySelector('[data-new-since]'))).toBe('1 new since your last visit');
		expect(norm(container.querySelector('[data-new-since-detail]'))).toBe(
			'1 new, 2 no longer listed'
		);
		expect(container.querySelector('[data-new-since-checked]')).toBeNull();
		expect(await axeViolations(container)).toEqual([]);
	});
});
