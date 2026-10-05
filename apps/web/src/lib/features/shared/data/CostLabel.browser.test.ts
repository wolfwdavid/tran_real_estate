import { afterEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import CostLabel from './CostLabel.svelte';
import type { CostEstimate } from './copy/provenance';

// Harness: `<button>Search rentals <CostLabel estimate={…} /></button>`.
const hosts: HTMLElement[] = [];
afterEach(() => {
	for (const h of hosts.splice(0)) h.remove();
});

async function inButton(verb: string, estimate: CostEstimate | 'free' | null) {
	const host = document.createElement('div');
	const button = document.createElement('button');
	button.type = 'button';
	button.append(`${verb} `);
	host.append(button);
	document.body.append(host);
	hosts.push(host);
	await render(CostLabel, { props: { estimate } }, { container: button });
	return { host, button };
}

const cases: Array<[string, CostEstimate | 'free', string]> = [
	['Search rentals', { calls: 1, reason: 'network' }, 'Search rentals (1 call)'],
	['Search rentals', { calls: 3, reason: 'network' }, 'Search rentals (3 calls)'],
	['Search rentals', { calls: 0, reason: 'cached' }, 'Search rentals (0 calls · cached)'],
	['Search rentals', { calls: 0, reason: 'sample' }, 'Search rentals (0 calls · sample data)'],
	['Test key', 'free', 'Test key (0 calls)']
];

describe('CostLabel', () => {
	test.each(cases)('%s with %o is part of the accessible name', async (verb, estimate, name) => {
		const { host, button } = await inButton(verb, estimate);
		await expect.element(page.getByRole('button', { name, exact: true })).toBeVisible();
		const cost = button.querySelector('span');
		expect(cost).not.toBeNull();
		expect(cost?.classList).toContain('font-normal');
		expect(cost?.classList).toContain('tabular-nums');
		expect(cost?.classList).not.toContain('sr-only');
		expect(cost?.hasAttribute('title')).toBe(false);
		expect(cost?.getClientRects().length).toBeGreaterThan(0);
		expect(await axeViolations(host)).toEqual([]);
	});

	test('renders nothing while the estimate is unknown', async () => {
		const { button } = await inButton('Search rentals', null);
		expect(button.querySelector('span')).toBeNull();
		await expect
			.element(page.getByRole('button', { name: 'Search rentals', exact: true }))
			.toBeVisible();
	});
});
