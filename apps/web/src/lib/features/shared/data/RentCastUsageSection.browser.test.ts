// The Settings "RentCast usage" section in real Chromium (DATA-02, DATA-03): the full meter, the
// cap editor and the data source choice, wired to a real data runtime on its own IndexedDB
// database with an injected clock, a fetch spy and a fake key port. Never fake timers.
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { announce } from '$lib/components/a11y/announcer.svelte';
import { axeViolations } from '$lib/testing/axe';
import { createDataRuntime, type DataRequest, type DataRuntime } from '$lib/data';
// eslint-disable-next-line no-restricted-imports -- test-only: an isolated real IndexedDB per test
import { createDataDb } from '$lib/data/platform';
import RentCastUsageSection from './RentCastUsageSection.svelte';

vi.mock('$lib/components/a11y/announcer.svelte', { spy: true });

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const clock = () => T0;
const TEST_KEY = 'test-key-not-real';

type KeyState = 'none' | 'locked' | 'available';

const rentals = (zip: string): DataRequest => ({
	endpoint: 'rental-listings',
	params: { zipCode: zip, status: 'Active', limit: 500, offset: 0 }
});

/** Synthetic, schema-valid listing rows with fictional addresses. */
const rows = (zip: string) => [
	{
		id: `ROW-${zip}-1`,
		price: 1500,
		status: 'Active',
		zipCode: zip,
		formattedAddress: `100 Sample Way, Testville, OK ${zip}`,
		addressLine1: '100 Sample Way',
		city: 'Testville',
		state: 'OK',
		propertyType: 'Single Family',
		bedrooms: 2,
		bathrooms: 1
	}
];

const fakeFetch = (async (input: RequestInfo | URL) => {
	const url = new URL(
		typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
	);
	return new Response(JSON.stringify(rows(url.searchParams.get('zipCode') ?? '74201')), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}) as typeof fetch;

const keys = (state: KeyState) => ({
	get: () => (state === 'available' ? TEST_KEY : null),
	state: () => state,
	onChange: () => () => undefined
});

// Component tests load no CSS, so the unstyled cap input and Save cap button stack 21px tall and
// touching, which axe's target-size rule flags. Restore the heights the real classes give them
// (as CapEditor.browser.test.ts does); the E2E axe runs cover the full stylesheet.
beforeAll(() => {
	const style = document.createElement('style');
	style.textContent = '[data-slot="button"], [data-slot="input"] { height: 48px; }';
	document.head.appendChild(style);
});

const teardown: (() => unknown)[] = [];
beforeEach(() => {
	vi.mocked(announce).mockClear();
});
afterEach(async () => {
	while (teardown.length) await teardown.pop()!();
	vi.restoreAllMocks();
});

/** A started runtime on a fresh database, seeded with a cap and `used` billed calls. */
async function liveRuntime(
	opts: { keys?: KeyState; cap?: number; used?: number; start?: boolean } = {}
): Promise<DataRuntime> {
	const db = createDataDb({ name: `usage-${crypto.randomUUID()}` });
	teardown.push(() => db.delete());
	const base = { db, clock, fetch: fakeFetch, keys: keys(opts.keys ?? 'available') };
	if (opts.cap !== undefined || opts.used) {
		const seeder = createDataRuntime({ ...base, channel: null });
		const stop = await seeder.start();
		if (opts.cap !== undefined) await seeder.saveCap(opts.cap);
		for (let i = 0; i < (opts.used ?? 0); i++) await seeder.requestSpend(rentals(`730${10 + i}`));
		stop();
	}
	const runtime = createDataRuntime({ ...base, channel: null });
	if (opts.start !== false) teardown.push(await runtime.start());
	return runtime;
}

async function mount(runtime: DataRuntime) {
	const target = document.createElement('div');
	document.body.append(target);
	teardown.push(() => target.remove());
	const screen = await render(RentCastUsageSection, { props: { runtime }, target });
	return { screen, target };
}

describe('RentCastUsageSection', () => {
	test('structure: section, h2, intro, then the three h3s in order', async () => {
		const { target } = await mount(await liveRuntime());
		const section = target.querySelector('section#rentcast-usage');
		expect(section).not.toBeNull();
		expect(section!.getAttribute('aria-labelledby')).toBe('rentcast-usage-heading');
		const h2 = section!.querySelector('h2#rentcast-usage-heading');
		expect(h2?.textContent?.trim()).toBe('RentCast usage');
		await expect
			.element(
				page.getByText(
					"Tran counts every RentCast call made from this browser and stops before your cap, so a busy week can't use up your free calls. Results are saved in this browser and reused, so repeating a search costs nothing."
				)
			)
			.toBeVisible();
		const h3s = [...section!.querySelectorAll('h3')].map((h) => h.textContent?.trim());
		expect(h3s).toEqual(['This month', 'Monthly call cap', 'Data source']);
	});

	test('hydrating: "Checking this browser…" where the meter goes; axe clean', async () => {
		const runtime = await liveRuntime({ start: false });
		const { target } = await mount(runtime);
		await expect.element(page.getByText('Checking this browser…')).toBeVisible();
		expect(target.querySelector('[role="group"]')).toBeNull();
		expect(await axeViolations(target)).toEqual([]);
	});

	test('live: full meter (12 used, cap 40) and the cap input prefilled; axe clean', async () => {
		const { target } = await mount(await liveRuntime({ cap: 40, used: 12 }));
		await expect.element(page.getByText('12 of 50 calls used this month')).toBeVisible();
		await expect.element(page.getByText(/^Cap: 40 · 28 left before your cap/)).toBeVisible();
		await expect.element(page.getByLabelText('Monthly call cap')).toHaveValue('40');
		expect(await axeViolations(target)).toEqual([]);
	});

	test('saving 25 calls runtime.saveCap(25) and the meter follows', async () => {
		const runtime = await liveRuntime({ cap: 40, used: 12 });
		const saveCap = vi.spyOn(runtime, 'saveCap');
		await mount(runtime);
		const input = page.getByLabelText('Monthly call cap');
		await input.fill('25');
		await page.getByRole('button', { name: 'Save cap' }).click();
		await expect.poll(() => saveCap.mock.calls).toEqual([[25]]);
		await expect.element(page.getByText(/^Cap: 25 · 13 left before your cap/)).toBeVisible();
		await expect.element(page.getByText('Cap saved: 25 calls a month.')).toBeVisible();
	});

	test('keyless: the no-key line with Add a RentCast key; axe clean', async () => {
		const { target } = await mount(await liveRuntime({ keys: 'none' }));
		await expect
			.element(page.getByText('Using sample data because no RentCast key is available.'))
			.toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Add a RentCast key' })).toBeVisible();
		expect(page.getByRole('radio').elements()).toHaveLength(0);
		expect(await axeViolations(target)).toEqual([]);
	});

	test('locked: the no-key line links to Unlock your keys', async () => {
		await mount(await liveRuntime({ keys: 'locked' }));
		await expect.element(page.getByRole('link', { name: 'Unlock your keys' })).toBeVisible();
	});

	test('key available: radios; choosing Sample data calls setSourcePreference and announces', async () => {
		const runtime = await liveRuntime();
		const setPref = vi.spyOn(runtime, 'setSourcePreference');
		await mount(runtime);
		const rentcast = page.getByRole('radio', { name: 'RentCast, with your key' });
		await expect.element(rentcast).toBeChecked();
		await userEvent.click(page.getByRole('radio', { name: 'Sample data' }));
		await expect.poll(() => setPref.mock.calls).toEqual([['sample']]);
		await expect.poll(() => runtime.mode?.reason).toBe('chosen');
		await expect.element(page.getByRole('radio', { name: 'Sample data' })).toBeChecked();
		await expect.poll(() => vi.mocked(announce).mock.calls.length).toBeGreaterThan(0);
	});

	test('a cap saved in another tab updates the meter and the cap input', async () => {
		const db = createDataDb({ name: `usage-${crypto.randomUUID()}` });
		teardown.push(() => db.delete());
		const handlers: ((e: { data: { type: 'cap-changed' } }) => void)[] = [];
		const channel = {
			postMessage: () => undefined,
			addEventListener: (_t: 'message', cb: (typeof handlers)[number]) => void handlers.push(cb),
			close: () => undefined
		};
		const base = { db, clock, fetch: fakeFetch, keys: keys('available') };
		const runtime = createDataRuntime({ ...base, channel });
		teardown.push(await runtime.start());
		await mount(runtime);
		await expect.element(page.getByLabelText('Monthly call cap')).toHaveValue('40');

		const other = createDataRuntime({ ...base, channel: null });
		const stop = await other.start();
		await other.saveCap(30);
		stop();
		for (const h of handlers) h({ data: { type: 'cap-changed' } });

		await expect.element(page.getByText(/^Cap: 30 · 30 left before your cap/)).toBeVisible();
		await expect.element(page.getByLabelText('Monthly call cap')).toHaveValue('30');
	});
});
