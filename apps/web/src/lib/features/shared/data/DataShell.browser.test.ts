// DataShell in real Chromium (DATA-01..03): the (app) layout's data runtime provider, status bar,
// cap-prompt host, check-on-open alerts and polite announcements. Every runtime runs on its own
// real IndexedDB database with an injected clock, a fetch spy and a fake key port; cross-tab sync
// uses an in-memory channel. Never fake timers.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { announce } from '$lib/components/a11y/announcer.svelte';
import { axeViolations } from '$lib/testing/axe';
import { createDataRuntime, savedSearchRepo, type DataRequest, type DataRuntime } from '$lib/data';
// eslint-disable-next-line no-restricted-imports -- test-only: an isolated real IndexedDB per test
import { createDataDb, type DataDb } from '$lib/data/platform';
import { DUE_DECLINED } from './copy/source';
import DataShellHarness from './testing/DataShellHarness.svelte';

// Spy on the real announcer (DataShell and the dialogs reach it through platform-ui).
vi.mock('$lib/components/a11y/announcer.svelte', { spy: true });

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const clock = () => T0;
const TEST_KEY = 'test-key-not-real';
const ZIPS = ['74201', '74202', '74203', '74204', '74205'];

type KeyState = 'none' | 'locked' | 'available';

const rentals = (zip: string): DataRequest => ({
	endpoint: 'rental-listings',
	params: { zipCode: zip, status: 'Active', limit: 500, offset: 0 }
});

/** Synthetic, schema-valid listing rows with fictional addresses. */
const rows = (zip: string) =>
	[1, 2].map((i) => ({
		id: `ROW-${zip}-${i}`,
		price: 1500,
		status: 'Active',
		zipCode: zip,
		formattedAddress: `${i}00 Sample Way, Testville, OK ${zip}`,
		addressLine1: `${i}00 Sample Way`,
		city: 'Testville',
		state: 'OK',
		propertyType: 'Single Family',
		bedrooms: 2,
		bathrooms: 1
	}));

/** RentCast stand-in that records calls; `hold()` parks every call until `release()`. */
function rentcast() {
	const calls: string[] = [];
	let gate: Promise<void> | null = null;
	let open: () => void = () => undefined;
	const fn = (async (input: RequestInfo | URL) => {
		const url = new URL(
			typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		);
		calls.push(url.href);
		if (gate) await gate;
		const zip = url.searchParams.get('zipCode') ?? '74201';
		return new Response(JSON.stringify(rows(zip)), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	}) as typeof fetch;
	return {
		fetch: fn,
		calls,
		hold() {
			gate = new Promise<void>((r) => (open = r));
		},
		release() {
			gate = null;
			open();
		}
	};
}

/** An in-memory stand-in for BroadcastChannel('tran-data'): `deliver` plays another tab. */
function fakeChannel() {
	const handlers: ((e: { data: { type: 'cap-changed' | 'source-changed' } }) => void)[] = [];
	return {
		postMessage: () => undefined,
		addEventListener: (_t: 'message', cb: (typeof handlers)[number]) => void handlers.push(cb),
		close: () => undefined,
		deliver: (type: 'cap-changed' | 'source-changed') => {
			for (const h of handlers) h({ data: { type } });
		}
	};
}

const keys = (state: KeyState) => ({
	get: () => (state === 'available' ? TEST_KEY : null),
	state: () => state,
	onChange: () => () => undefined
});

const teardown: (() => unknown)[] = [];
beforeEach(() => {
	vi.mocked(announce).mockClear();
});
afterEach(async () => {
	while (teardown.length) await teardown.pop()!();
	vi.restoreAllMocks();
});

interface World {
	db: DataDb;
	net: ReturnType<typeof rentcast>;
	channel: ReturnType<typeof fakeChannel>;
	runtime: DataRuntime;
}

/**
 * One database seeded through a separate, short-lived runtime (cap + `used` billed calls + saved
 * searches), then a fresh runtime for the shell, as if the app had just been opened.
 */
async function world(
	opts: { keys?: KeyState; cap?: number; used?: number; searches?: string[] } = {}
): Promise<World> {
	const db = createDataDb({ name: `shell-${crypto.randomUUID()}` });
	teardown.push(() => db.delete());
	const net = rentcast();
	teardown.push(() => net.release()); // a failed test never leaves a call parked
	const base = { db, clock, fetch: net.fetch, keys: keys(opts.keys ?? 'available') };

	const seeder = createDataRuntime({ ...base, channel: null });
	const stop = await seeder.start();
	if (opts.cap !== undefined) await seeder.saveCap(opts.cap);
	for (let i = 0; i < (opts.used ?? 0); i++) await seeder.requestSpend(rentals(`7300${i}`));
	stop();
	const repo = savedSearchRepo({ db, clock });
	for (const zip of opts.searches ?? []) {
		await repo.create({
			portal: 'renter',
			name: `Rentals in ${zip}`,
			endpoint: 'rental-listings',
			params: { zipCode: zip, status: 'Active', limit: 500, offset: 0 }
		});
	}
	net.calls.length = 0;

	const channel = fakeChannel();
	const runtime = createDataRuntime({ ...base, channel });
	return { db, net, channel, runtime };
}

async function mount(
	w: World,
	opts: { showStatusBar?: boolean; runAlerts?: boolean; zip?: string } = {}
) {
	const screen = await render(DataShellHarness, {
		props: {
			runtime: w.runtime,
			showStatusBar: opts.showStatusBar ?? true,
			...(opts.runAlerts === undefined ? {} : { runAlerts: opts.runAlerts }),
			alerts: { db: w.db, clock },
			request: rentals(opts.zip ?? '75001')
		}
	});
	teardown.push(() => screen.unmount());
	return screen;
}

const region = () => page.getByRole('region', { name: 'Data source' });
const announced = () => vi.mocked(announce).mock.calls.map((c) => c[0]);
/** Lets pending liveQuery emissions and microtasks land. */
const settle = () => new Promise((r) => setTimeout(r, 100));

describe('DataShell status bar', () => {
	test('shows "Checking data source…" until the runtime has started', async () => {
		const pending: DataRuntime = {
			mode: null,
			usage: null,
			gateway: null,
			capPrompt: null,
			lastRemoteChange: null,
			start: () => new Promise(() => undefined),
			requestSpend: () => new Promise(() => undefined),
			confirmCapPrompt: async () => undefined,
			cancelCapPrompt: () => undefined,
			setSourcePreference: async () => undefined,
			saveCap: async () => undefined,
			testKey: () => new Promise(() => undefined)
		};
		const screen = await render(DataShellHarness, {
			props: { runtime: pending, request: rentals('75001') }
		});
		teardown.push(() => screen.unmount());
		await expect.element(region()).toHaveTextContent('Checking data source…');
	});

	test('keyless: Sample data with the no-key explanation, first child of <main>, axe clean', async () => {
		const w = await world({ keys: 'none' });
		const screen = await mount(w);
		await expect.element(region()).toHaveTextContent('Sample data');
		await expect
			.element(region())
			.toHaveTextContent('The places, people, and numbers here are made up.');
		await expect
			.element(region().getByRole('link', { name: 'Add a RentCast key' }))
			.toHaveAttribute('href', '/settings/#api-keys');
		const main = screen.container.querySelector('main')!;
		expect(main.firstElementChild?.getAttribute('aria-label')).toBe('Data source');
		await settle();
		expect(announced()).toEqual([]);
		expect(await axeViolations(screen.container)).toEqual([]);
	});

	test('showStatusBar false renders no Data source region', async () => {
		const w = await world({ keys: 'none' });
		await mount(w, { showStatusBar: false });
		await expect.element(page.getByRole('button', { name: 'Search rentals' })).toBeVisible();
		await settle();
		expect(document.querySelector('[aria-label="Data source"]')).toBeNull();
	});

	test('live: the compact meter, axe clean', async () => {
		const w = await world({ cap: 40, used: 2 });
		const screen = await mount(w);
		await expect.element(region()).not.toHaveTextContent('Checking data source…');
		await expect.element(region()).not.toHaveTextContent('Sample data');
		await expect.element(region()).toHaveTextContent('2 of 50');
		expect(await axeViolations(screen.container)).toEqual([]);
	});
});

describe('DataShell cap prompt host', () => {
	test('a spend at the cap opens CapConfirmDialog; Spend 1 call anyway makes exactly 1 fetch', async () => {
		const w = await world({ cap: 1, used: 1 });
		await mount(w);
		await expect.element(region()).toHaveTextContent('1 of 50');
		await page.getByRole('button', { name: 'Search rentals' }).click();
		const dialog = page.getByRole('alertdialog');
		await expect
			.element(dialog.getByRole('heading', { name: 'This call goes past your cap' }))
			.toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Not now' })).toHaveFocus();
		expect(w.net.calls).toHaveLength(0);
		await page.getByRole('button', { name: 'Spend 1 call anyway' }).click();
		await expect.element(page.getByTestId('outcome')).toHaveTextContent('spent');
		await expect.element(dialog).not.toBeInTheDocument();
		expect(w.net.calls).toHaveLength(1);
	});

	test('Not now announces "Nothing was spent." and the spend rejects as dismissed', async () => {
		const w = await world({ cap: 1, used: 1 });
		await mount(w);
		await expect.element(region()).toHaveTextContent('1 of 50');
		await page.getByRole('button', { name: 'Search rentals' }).click();
		await page.getByRole('button', { name: 'Not now' }).click();
		await expect.element(page.getByTestId('outcome')).toHaveTextContent('error:dismissed');
		expect(announced()).toContain('Nothing was spent.');
		expect(w.net.calls).toHaveLength(0);
	});
});

describe('DataShell check-on-open', () => {
	test('5 due: DueSearchesDialog, progress label, then one "Nothing new" announcement', async () => {
		const w = await world({ cap: 40, searches: ZIPS });
		w.net.hold();
		await mount(w);
		const dialog = page.getByRole('alertdialog');
		await expect
			.element(dialog.getByRole('heading', { name: 'Check 5 saved searches for new listings?' }))
			.toBeVisible();
		expect(w.net.calls).toHaveLength(0);
		await page.getByRole('button', { name: 'Check 5 searches (5 calls)' }).click();
		await expect.element(dialog).toHaveTextContent('Checking 1 of 5…');
		w.net.release();
		await expect.element(dialog).not.toBeInTheDocument();
		await vi.waitFor(() => expect(announced()).toContain('Checked 5 saved searches. Nothing new.'));
		expect(w.net.calls).toHaveLength(5);
	});

	test('5 due: Not now announces the declined line and spends nothing', async () => {
		const w = await world({ cap: 40, searches: ZIPS });
		await mount(w);
		await page.getByRole('button', { name: 'Not now' }).click();
		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(announced()).toContain(DUE_DECLINED);
		await settle();
		expect(w.net.calls).toHaveLength(0);
	});

	test('1-3 due run silently, then announce once', async () => {
		const w = await world({ cap: 40, searches: ZIPS.slice(0, 2) });
		await mount(w);
		await vi.waitFor(() => expect(announced()).toContain('Checked 2 saved searches. Nothing new.'));
		expect(document.querySelector('[role="alertdialog"]')).toBeNull();
		expect(w.net.calls).toHaveLength(2);
	});

	test('at the cap: no dialog, no fetch, the "weren\'t checked" line, axe clean', async () => {
		const w = await world({ cap: 1, used: 1, searches: ZIPS });
		const screen = await mount(w);
		await expect
			.element(region())
			.toHaveTextContent(
				"Saved searches weren't checked because you've reached your cap. 5 are waiting."
			);
		expect(document.querySelector('[role="alertdialog"]')).toBeNull();
		expect(w.net.calls).toHaveLength(0);
		expect(await axeViolations(screen.container)).toEqual([]);
	});

	test('sample mode: due searches run free and silently when nothing is new', async () => {
		const w = await world({ keys: 'none', searches: ['74201', '74203', '70201', '70204'] });
		await mount(w);
		await expect.element(region()).toHaveTextContent('Sample data');
		await settle();
		await settle();
		expect(document.querySelector('[role="alertdialog"]')).toBeNull();
		expect(w.net.calls).toHaveLength(0);
		expect(announced()).toEqual([]);
	});
});

describe('DataShell runAlerts gate (08-27, SC5)', () => {
	const CHECKED_2 = 'Checked 2 saved searches. Nothing new.';
	const dialogShown = () => document.querySelector('[role="alertdialog"]') !== null;
	const checkedCount = (text: string) => announced().filter((m) => m === text).length;
	/** The runtime has started once the live bar shows the meter. */
	const started = async () => {
		await expect.element(region()).toHaveTextContent('RentCast calls:');
		await settle();
		await settle();
	};

	test('runAlerts false, 2 due: no fetch, no announcement, searches stay due', async () => {
		const w = await world({ cap: 40, searches: ZIPS.slice(0, 2) });
		await mount(w, { runAlerts: false });
		await started();
		expect(w.net.calls).toHaveLength(0);
		expect(announced().filter((m) => m.startsWith('Checked'))).toEqual([]);
		expect(dialogShown()).toBe(false);
		const rows = await savedSearchRepo({ db: w.db, clock }).list();
		expect(rows).toHaveLength(2);
		for (const row of rows) {
			expect(row.lastRunAt).toBeNull();
			expect(row.claimedAt).toBeNull();
		}
	});

	test('runAlerts false, 5 due: no DueSearchesDialog', async () => {
		const w = await world({ cap: 40, searches: ZIPS });
		await mount(w, { runAlerts: false });
		await started();
		expect(dialogShown()).toBe(false);
		expect(w.net.calls).toHaveLength(0);
	});

	test('deferred start: false -> true runs the pass once, later toggles run nothing', async () => {
		const w = await world({ cap: 40, searches: ZIPS.slice(0, 2) });
		const screen = await mount(w, { runAlerts: false });
		await started();
		expect(w.net.calls).toHaveLength(0);
		await screen.rerender({ runAlerts: true });
		await vi.waitFor(() => expect(announced()).toContain(CHECKED_2));
		expect(w.net.calls).toHaveLength(2);
		for (const runAlerts of [false, true, false, true, false]) {
			await screen.rerender({ runAlerts });
			await settle();
		}
		await settle();
		expect(w.net.calls).toHaveLength(2);
		expect(checkedCount(CHECKED_2)).toBe(1);
	});

	test('deferred start with 5 due asks as usual', async () => {
		const w = await world({ cap: 40, searches: ZIPS });
		const screen = await mount(w, { runAlerts: false });
		await started();
		expect(dialogShown()).toBe(false);
		await screen.rerender({ runAlerts: true });
		await expect
			.element(
				page
					.getByRole('alertdialog')
					.getByRole('heading', { name: 'Check 5 saved searches for new listings?' })
			)
			.toBeVisible();
		expect(w.net.calls).toHaveLength(0);
		// Not now leaves the searches due, so only the once-per-mount latch keeps later toggles from
		// asking again (the scheduler's own claim does not cover a declined pass).
		await page.getByRole('button', { name: 'Not now' }).click();
		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		for (const runAlerts of [false, true, false, true]) {
			await screen.rerender({ runAlerts });
			await settle();
		}
		await settle();
		expect(dialogShown()).toBe(false);
		expect(announced().filter((m) => m === DUE_DECLINED)).toHaveLength(1);
		expect(w.net.calls).toHaveLength(0);
	});

	test('leaving while asking withdraws the dialog unspent', async () => {
		const w = await world({ cap: 40, searches: ZIPS });
		const screen = await mount(w, { runAlerts: true });
		const dialog = page.getByRole('alertdialog');
		await expect
			.element(dialog.getByRole('heading', { name: 'Check 5 saved searches for new listings?' }))
			.toBeVisible();
		await screen.rerender({ runAlerts: false });
		await expect.element(dialog).not.toBeInTheDocument();
		await settle();
		expect(w.net.calls).toHaveLength(0);
		expect(announced()).not.toContain(DUE_DECLINED);
		await screen.rerender({ runAlerts: true });
		await settle();
		await settle();
		expect(dialogShown()).toBe(false);
		expect(w.net.calls).toHaveLength(0);
	});

	test('flip to true before start resolves runs exactly once', async () => {
		const w = await world({ cap: 40, searches: ZIPS.slice(0, 2) });
		const screen = await mount(w, { runAlerts: false });
		await screen.rerender({ runAlerts: true });
		await vi.waitFor(() => expect(announced()).toContain(CHECKED_2));
		await settle();
		await settle();
		expect(w.net.calls).toHaveLength(2);
		expect(checkedCount(CHECKED_2)).toBe(1);
	});
});

describe('DataShell announcements', () => {
	test('crossing into Near cap announces once; loading already near announces nothing', async () => {
		const w = await world({ cap: 10, used: 4 });
		await mount(w);
		await expect.element(region()).toHaveTextContent('4 of 50');
		await settle();
		expect(announced()).toEqual([]);
		await page.getByRole('button', { name: 'Search rentals' }).click();
		await expect.element(page.getByTestId('outcome')).toHaveTextContent('spent');
		await vi.waitFor(() => expect(announced()).toContain('5 RentCast calls left before your cap.'));
		await settle();
		expect(announced().filter((m) => m === '5 RentCast calls left before your cap.')).toHaveLength(
			1
		);
	});

	test('loading at Near cap announces nothing', async () => {
		const w = await world({ cap: 10, used: 5 });
		await mount(w);
		await expect.element(region()).toHaveTextContent('5 of 50');
		await settle();
		expect(announced()).toEqual([]);
	});

	test('a cap change in another tab is announced', async () => {
		const w = await world({ cap: 40 });
		await mount(w);
		await expect.element(region()).toHaveTextContent('0 of 50');
		w.channel.deliver('cap-changed');
		await vi.waitFor(() =>
			expect(announced()).toContain('Your RentCast cap was changed in another Tran tab.')
		);
	});

	test('a data source change in another tab announces the new source', async () => {
		const live = await world({ cap: 40 });
		await mount(live);
		await expect.element(region()).toHaveTextContent('0 of 50');
		live.channel.deliver('source-changed');
		await vi.waitFor(() => expect(announced()).toContain('Showing RentCast data.'));
	});

	test('sample source change from another tab announces sample data', async () => {
		const w = await world({ keys: 'none' });
		await mount(w);
		await expect.element(region()).toHaveTextContent('Sample data');
		w.channel.deliver('source-changed');
		await vi.waitFor(() => expect(announced()).toContain('Showing sample data.'));
	});
});
