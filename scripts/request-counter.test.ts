// The emulator's opt-in request counter (SERVE_PAGES_COUNT_FILE in scripts/serve-pages.mjs).
import { describe, expect, test } from 'vitest';
import { createRequestCounter } from './lib/request-counter.mjs';

describe('createRequestCounter', () => {
	test('a fresh counter snapshots to zero', () => {
		expect(createRequestCounter().snapshot()).toEqual({ total: 0, byPort: {}, byPath: {} });
	});

	test('GET and HEAD are counted', () => {
		const c = createRequestCounter();
		c.record(4273, 'GET', '/');
		c.record(4273, 'HEAD', '/');
		expect(c.snapshot()).toEqual({ total: 2, byPort: { 4273: 2 }, byPath: { '4273 /': 2 } });
	});

	test('POST and a missing method are not counted', () => {
		const c = createRequestCounter();
		c.record(4273, 'POST', '/api/send');
		c.record(4273, undefined, '/');
		expect(c.snapshot().total).toBe(0);
	});

	test('the query is stripped from byPath', () => {
		const c = createRequestCounter();
		c.record(4273, 'GET', '/_app/version.json?t=1');
		c.record(4273, 'GET', '/_app/version.json?t=2');
		expect(c.snapshot().byPath).toEqual({ '4273 /_app/version.json': 2 });
	});

	test('byPort splits two ports and byPath keeps them apart', () => {
		const c = createRequestCounter();
		c.record(4273, 'GET', '/');
		c.record(4274, 'GET', '/');
		c.record(4274, 'GET', '/renter/');
		expect(c.snapshot()).toEqual({
			total: 3,
			byPort: { 4273: 1, 4274: 2 },
			byPath: { '4273 /': 1, '4274 /': 1, '4274 /renter/': 1 }
		});
	});

	test('a snapshot is a copy, not a live view', () => {
		const c = createRequestCounter();
		const before = c.snapshot();
		c.record(4273, 'GET', '/');
		expect(before.total).toBe(0);
		expect(before.byPath).toEqual({});
	});
});
