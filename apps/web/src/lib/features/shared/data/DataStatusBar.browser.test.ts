import { afterEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import DataStatusBar from './DataStatusBar.svelte';

const NOV_1 = Date.parse('2026-11-01T00:00:00Z');

type Status =
	| 'hydrating'
	| { kind: 'sample'; reason: 'no-key' | 'locked' | 'chosen' }
	| {
			kind: 'live';
			used: number;
			unbilled: number;
			cap: number;
			resetsAt: number;
			waiting: number;
			skippedForCap: boolean;
	  };

const live = (over: Partial<Extract<Status, { kind: 'live' }>> = {}): Status => ({
	kind: 'live',
	used: 12,
	unbilled: 0,
	cap: 40,
	resetsAt: NOV_1,
	waiting: 0,
	skippedForCap: false,
	...over
});

/** A 375px-wide host inside a `<main>` (the bar renders inside the layout's main landmark). */
function host(width = 375): HTMLElement {
	const main = document.createElement('main');
	const target = document.createElement('div');
	target.style.width = `${width}px`;
	main.appendChild(target);
	document.body.appendChild(main);
	return target;
}

async function mount(status: Status) {
	const target = host();
	await render(DataStatusBar, { props: { status }, target });
	const region = target.querySelector<HTMLElement>('[role="region"]');
	expect(region).not.toBeNull();
	return { target, region: region! };
}

afterEach(() => {
	document.querySelectorAll('body > main').forEach((m) => m.remove());
});

describe('DataStatusBar', () => {
	test('hydrating: named region, not a live region', async () => {
		const { target, region } = await mount('hydrating');
		expect(region.getAttribute('aria-label')).toBe('Data source');
		expect(region.textContent).toContain('Checking data source…');
		expect(target.querySelector('[aria-live]')).toBeNull();
		expect(region.outerHTML).toContain('min-h-11');
		expect(await axeViolations(target)).toEqual([]);
	});

	test('sample/no-key: label, explanation, link, accent surface, flask icon', async () => {
		const { target, region } = await mount({ kind: 'sample', reason: 'no-key' });
		const text = region.textContent!.replace(/\s+/g, ' ');
		expect(text).toContain('Sample data');
		expect(text).toContain('The places, people, and numbers here are made up.');
		await expect
			.element(page.getByRole('link', { name: 'Add a RentCast key' }))
			.toHaveAttribute('href', '/settings/#api-keys');
		expect(region.className).toContain('bg-accent-surface');
		const icon = region.querySelector('svg[data-icon="flask-conical"]');
		expect(icon?.getAttribute('aria-hidden')).toBe('true');
		expect(await axeViolations(target)).toEqual([]);
	});

	test('sample/locked', async () => {
		const { target, region } = await mount({ kind: 'sample', reason: 'locked' });
		expect(region.textContent).toContain(
			"Your RentCast key is locked, so you're seeing made-up places, people, and numbers."
		);
		await expect
			.element(page.getByRole('link', { name: 'Unlock your keys' }))
			.toHaveAttribute('href', '/settings/#key-security');
		expect(await axeViolations(target)).toEqual([]);
	});

	test('sample/chosen', async () => {
		const { target, region } = await mount({ kind: 'sample', reason: 'chosen' });
		expect(region.textContent).toContain(
			'You chose sample data. The places, people, and numbers here are made up.'
		);
		await expect
			.element(page.getByRole('link', { name: 'Switch to RentCast' }))
			.toHaveAttribute('href', '/settings/#rentcast-usage');
		expect(await axeViolations(target)).toEqual([]);
	});

	test('live: compact meter on the page background', async () => {
		const { target, region } = await mount(live());
		await expect
			.element(page.getByRole('group', { name: 'RentCast calls: 12 of 50 this month' }))
			.toBeVisible();
		expect(region.className).toContain('bg-background');
		expect(region.className).not.toContain('bg-accent-surface');
		expect(region.textContent).not.toContain('Sample data');
		expect(region.textContent).not.toContain('saved search');
		expect(await axeViolations(target)).toEqual([]);
	});

	test('live + alerts skipped at cap: second line with Change your cap link', async () => {
		const { target, region } = await mount(live({ used: 40, waiting: 3, skippedForCap: true }));
		expect(region.textContent).toContain(
			"Saved searches weren't checked because you've reached your cap. 3 are waiting."
		);
		await expect
			.element(page.getByRole('link', { name: 'Change your cap' }))
			.toHaveAttribute('href', '/settings/#rentcast-usage');
		const pause = region.querySelectorAll('svg[data-icon="circle-pause"]');
		expect(pause.length).toBeGreaterThan(0);
		expect(await axeViolations(target)).toEqual([]);
	});

	test('live + partially run: waiting line', async () => {
		const { target, region } = await mount(live({ used: 38, waiting: 2 }));
		expect(region.textContent).toContain(
			"2 saved searches are waiting until there's room under your cap."
		);
		expect(region.textContent).not.toContain('Change your cap');
		expect(await axeViolations(target)).toEqual([]);
	});

	test.each<[string, Status]>([
		['hydrating', 'hydrating'],
		['sample/locked', { kind: 'sample', reason: 'locked' }],
		['live + alerts', live({ used: 40, waiting: 12, skippedForCap: true })]
	])('%s: wraps with no horizontal overflow at 375px', async (_name, status) => {
		const { region } = await mount(status);
		expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth);
		expect(region.outerHTML).toContain('flex-wrap');
	});
});
