// Layer 3 of the "views never spend" defense (04-RESEARCH Pitfall 2; roadmap Phase 4 criterion 3):
// re-rendering a real gateway-backed Svelte view 10 times in Chromium spends no extra RentCast calls.
// Counted twice: spy fetch calls and ledger rows. The mutant view (spend inside $effect) proves the
// count would catch a regression: with the real guard it is blocked, without it the spy sees calls.
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { DataRequest } from '@tran/core/request';
import rentalsFixture from './fixtures/rentals.json';
import { createDataDb, type DataDb, type RentCastKeyState } from './platform';
import { inReactiveContext } from './reactive-guard.svelte';
import { createDataRuntime, type DataRuntime, type KeyPort } from './runtime.svelte';
import { jsonResponse, spyFetch, T0, TEST_KEY } from './testing/harness';
import { rentals } from './testing/gateway-harness';
import MutantEffectView from './testing/MutantEffectView.svelte';
import PeekView from './testing/PeekView.svelte';

const RERENDERS = 10;
const SLICE_74201 = (rentalsFixture as { zipCode: string }[]).filter((r) => r.zipCode === '74201');

const keys = (state: RentCastKeyState): KeyPort => ({
	get: () => (state === 'available' ? TEST_KEY : null),
	state: () => state,
	onChange: () => () => undefined
});

const teardown: (() => unknown)[] = [];
afterEach(async () => {
	while (teardown.length) await teardown.pop()!();
});

async function setup(state: RentCastKeyState, { reactiveGuard }: { reactiveGuard: () => boolean }) {
	const db: DataDb = createDataDb({ name: `rerender-${crypto.randomUUID()}` });
	teardown.push(() => db.delete());
	const net = spyFetch((url) =>
		jsonResponse(
			200,
			(rentalsFixture as { zipCode: string }[]).filter(
				(r) => r.zipCode === url.searchParams.get('zipCode')
			)
		)
	);
	const runtime: DataRuntime = createDataRuntime({
		db,
		clock: () => T0,
		fetch: net.fetch,
		keys: keys(state),
		channel: null,
		reactiveGuard
	});
	teardown.push(await runtime.start());
	return { runtime, db, calls: net.calls, ledgerRows: () => db.ledger.count() };
}

/** Lets pending effects, liveQuery emissions and any stray fetch land before counting. */
const settle = () => new Promise((r) => setTimeout(r, 100));

async function renderPeek(runtime: DataRuntime, request: DataRequest) {
	const screen = await render(PeekView, { props: { runtime, request, tick: 0 } });
	teardown.push(() => screen.unmount());
	for (let i = 1; i <= RERENDERS; i++) {
		// A fresh props object (and a fresh request object with equal content) every time.
		await screen.rerender({ tick: i, request: { ...request, params: { ...request.params } } });
	}
	await expect.element(screen.getByTestId('tick')).toHaveTextContent(String(RERENDERS));
	return screen;
}

describe('rerender: 10 re-renders of a gateway-backed view spend 0 extra calls', () => {
	it('live mode, warm cache: 1 explicit spend, then 10 re-renders → still 1 call and 1 ledger row', async () => {
		const { runtime, calls, ledgerRows } = await setup('available', {
			reactiveGuard: inReactiveContext
		});
		await runtime.requestSpend(rentals('74201'));
		expect(calls).toHaveLength(1);
		expect(await ledgerRows()).toBe(1);

		const screen = await renderPeek(runtime, rentals('74201'));
		await expect.element(screen.getByTestId('rows')).toHaveTextContent(String(SLICE_74201.length));
		await settle();
		expect(calls).toHaveLength(1);
		expect(await ledgerRows()).toBe(1);
	});

	it('live mode, empty cache: 10 re-renders → 0 calls, 0 ledger rows, rows "none"', async () => {
		const { runtime, calls, ledgerRows } = await setup('available', {
			reactiveGuard: inReactiveContext
		});
		const screen = await renderPeek(runtime, rentals('74201'));
		await settle();
		await expect.element(screen.getByTestId('rows')).toHaveTextContent('none');
		expect(calls).toHaveLength(0);
		expect(await ledgerRows()).toBe(0);
	});

	it('sample mode: 10 re-renders → fixture rows shown, 0 live calls', async () => {
		const { runtime, calls, ledgerRows } = await setup('none', {
			reactiveGuard: inReactiveContext
		});
		expect(runtime.gateway?.source).toBe('sample');
		const screen = await renderPeek(runtime, rentals('74201'));
		await expect.element(screen.getByTestId('rows')).toHaveTextContent(String(SLICE_74201.length));
		expect(SLICE_74201.length).toBeGreaterThan(0);
		await settle();
		expect(calls).toHaveLength(0);
		expect(await ledgerRows()).toBe(0);
	});
});

describe('rerender: the count is non-vacuous (mutant view spends inside $effect)', () => {
	it('with the real guard (inReactiveContext) every effect spend is blocked: 0 calls', async () => {
		const { runtime, calls, ledgerRows } = await setup('available', {
			reactiveGuard: inReactiveContext
		});
		const screen = await render(MutantEffectView, {
			props: { runtime, request: rentals('74201'), tick: 0 }
		});
		teardown.push(() => screen.unmount());
		for (let i = 1; i <= RERENDERS; i++) await screen.rerender({ tick: i });
		await expect.element(screen.getByTestId('blocked')).toHaveTextContent('true');
		await settle();
		expect(calls).toHaveLength(0);
		expect(await ledgerRows()).toBe(0);
	});

	it('with the guard disabled (reactiveGuard: () => false) the mutant spends and the spy counts it', async () => {
		const { runtime, calls, ledgerRows } = await setup('available', { reactiveGuard: () => false });
		const zip = (i: number) => `742${String(i).padStart(2, '0')}`;
		const screen = await render(MutantEffectView, {
			props: { runtime, request: rentals(zip(0)), tick: 0 }
		});
		teardown.push(() => screen.unmount());
		// A distinct request per re-render, so every effect run is a cache miss.
		for (let i = 1; i <= RERENDERS; i++)
			await screen.rerender({ tick: i, request: rentals(zip(i)) });
		await settle();
		await expect.element(screen.getByTestId('blocked')).toHaveTextContent('false');
		// The mutant's spends are async (a Dexie cache read, then the fetch spy, then the ledger
		// write): poll for them instead of trusting the fixed 100 ms settle, which a loaded single
		// core can outrun (the spend then lands after teardown closed the database).
		await expect.poll(() => calls.length).toBeGreaterThan(0);
		await expect.poll(() => ledgerRows()).toBeGreaterThan(0);
	});
});
