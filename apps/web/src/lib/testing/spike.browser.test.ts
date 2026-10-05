import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from './axe';
import Spike from './Spike.svelte';

// Wave-0 spike (RESEARCH Pitfall 14): browser mode, the shared network ban and axe coexist.
describe('web-browser project', () => {
	test('renders a Svelte 5 component in real Chromium', async () => {
		await render(Spike);
		await expect
			.element(page.getByRole('button', { name: 'Search rentals (1 call)' }))
			.toBeVisible();
	});

	test('the no-network setup file is active in the browser', async () => {
		await expect(async () => {
			// eslint-disable-next-line no-restricted-syntax -- proves the network ban
			await fetch('https://api.rentcast.io/v1/markets');
		}).rejects.toThrow('Network access is disabled');
	});

	test('a clean fragment has no axe violations', async () => {
		const { container } = await render(Spike);
		expect(await axeViolations(container)).toEqual([]);
	});

	test('a planted violation is reported (non-vacuity)', async () => {
		const { container } = await render(Spike, { props: { planted: true } });
		const violations = await axeViolations(container);
		expect(violations.some((v) => v.startsWith('image-alt:'))).toBe(true);
	});
});
