// The 0-call peek store in real Chromium IndexedDB (DATA-02): views read cached data reactively
// and never spend. Only an explicit requestSpend (a click handler) calls RentCast.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { DataRequest } from '@tran/core/request';
import { createDataDb, type DataDb, type RentCastKeyState } from './platform';
import { createDataRuntime, type DataRuntime, type KeyPort } from './runtime.svelte';
import { createPeekStore } from './stores.svelte';
import { reactiveBox, withEffectRoot } from './testing/effect-root.svelte';
import { jsonResponse, spyFetch, T0, TEST_KEY } from './testing/harness';
import { listingRows, rentals } from './testing/gateway-harness';

const keys = (state: RentCastKeyState): KeyPort => ({
	get: () => (state === 'available' ? TEST_KEY : null),
	state: () => state,
	onChange: () => () => undefined
});

const teardown: (() => void | Promise<void>)[] = [];
afterEach(async () => {
	while (teardown.length) await teardown.pop()!();
});

async function setup(state: RentCastKeyState) {
	const db: DataDb = createDataDb({ name: `stores-${crypto.randomUUID()}` });
	teardown.push(() => db.delete());
	const net = spyFetch((url) =>
		jsonResponse(200, listingRows(2, url.searchParams.get('zipCode') ?? '74201'))
	);
	// Default reactive guard ($effect.tracking()): the store's effects must never trip it.
	const rt: DataRuntime = createDataRuntime({
		db,
		clock: () => T0,
		fetch: net.fetch,
		keys: keys(state),
		channel: null
	});
	const stop = await rt.start();
	teardown.push(stop);
	return { rt, calls: net.calls };
}

function peek(rt: DataRuntime, initial: DataRequest | null) {
	const request = reactiveBox<DataRequest | null>(initial);
	const root = withEffectRoot(() => createPeekStore(rt, () => request.current));
	teardown.push(root.dispose);
	flushSync();
	return { store: root.value, request };
}

/** Lets pending liveQuery emissions land, then asserts nothing changed. */
const settle = () => new Promise((r) => setTimeout(r, 50));

describe('createPeekStore', () => {
	it('live mode: empty cache → undefined with 0 fetches; an explicit spend fills it (1 fetch total)', async () => {
		const { rt, calls } = await setup('available');
		const { store } = peek(rt, rentals('74201'));
		await vi.waitFor(() => expect(store.loading).toBe(false));
		await settle();
		expect(store.current).toBeUndefined();
		expect(calls).toHaveLength(0);

		await rt.requestSpend(rentals('74201'));
		await vi.waitFor(() => expect(store.current?.kind).toBe('data'));
		const current = store.current;
		expect(current?.kind === 'data' && current.result.provenance.source).toBe('rentcast');
		await settle();
		expect(calls).toHaveLength(1);
	});

	it('re-peeks when the request changes (0 fetches); null → undefined', async () => {
		const { rt, calls } = await setup('available');
		await rt.requestSpend(rentals('74201'));
		expect(calls).toHaveLength(1);

		const { store, request } = peek(rt, rentals('74201'));
		await vi.waitFor(() => expect(store.current?.kind).toBe('data'));

		request.current = rentals('70201');
		flushSync();
		await vi.waitFor(() => expect(store.loading).toBe(false));
		expect(store.current).toBeUndefined();

		request.current = rentals('74201');
		flushSync();
		await vi.waitFor(() => expect(store.current?.kind).toBe('data'));

		request.current = null;
		flushSync();
		expect(store.current).toBeUndefined();
		expect(store.loading).toBe(false);
		await settle();
		expect(calls).toHaveLength(1);
	});

	it('sample mode resolves fixture data with 0 live fetches', async () => {
		const { rt, calls } = await setup('none');
		expect(rt.gateway?.source).toBe('sample');
		const { store } = peek(rt, rentals('74201'));
		await vi.waitFor(() => expect(store.current?.kind).toBe('data'));
		const current = store.current;
		expect(current?.kind === 'data' && current.result.provenance.source).toBe('sample');
		await settle();
		expect(calls).toHaveLength(0);
	});
});
