import { describe, expect, it, vi } from 'vitest';
import { formatBytes, persistenceStatus, requestPersistence, storageEstimate } from './persistence';

function fakeNav(o: { persist?: boolean; persisted?: boolean; estimate?: unknown } = {}) {
	return {
		storage: {
			persist: vi.fn(() => Promise.resolve(o.persist ?? false)),
			persisted: vi.fn(() => Promise.resolve(o.persisted ?? false)),
			estimate: vi.fn(() =>
				o.estimate instanceof Error
					? Promise.reject(o.estimate)
					: Promise.resolve((o.estimate ?? { usage: 10, quota: 100 }) as StorageEstimate)
			)
		}
	};
}

describe('requestPersistence', () => {
	it('calls persist() synchronously, before any await can resolve', async () => {
		const nav = fakeNav({ persist: true });
		const pending = requestPersistence(nav);
		// Checked before yielding to the microtask queue: proves no await precedes the call.
		expect(nav.storage.persist).toHaveBeenCalledTimes(1);
		await Promise.resolve();
		expect(nav.storage.persist).toHaveBeenCalledTimes(1);
		await pending;
	});

	it("resolves 'granted' when persist() is true", async () => {
		await expect(requestPersistence(fakeNav({ persist: true }))).resolves.toBe('granted');
	});

	it("resolves 'not-granted' when persist() is false", async () => {
		await expect(requestPersistence(fakeNav({ persist: false }))).resolves.toBe('not-granted');
	});

	it("resolves 'not-reported' when the Storage API is missing", async () => {
		await expect(requestPersistence({})).resolves.toBe('not-reported');
		await expect(requestPersistence({ storage: {} })).resolves.toBe('not-reported');
	});

	it("resolves 'not-reported' when persist() rejects", async () => {
		const nav = { storage: { persist: vi.fn(() => Promise.reject(new Error('x'))) } };
		await expect(requestPersistence(nav)).resolves.toBe('not-reported');
	});

	it('does not ask again once persisted() reported true this session', async () => {
		const nav = fakeNav({ persisted: true, persist: false });
		await expect(persistenceStatus(nav)).resolves.toBe('granted');
		await expect(requestPersistence(nav)).resolves.toBe('granted');
		expect(nav.storage.persist).not.toHaveBeenCalled();
	});

	it('does not ask again after a granted request', async () => {
		const nav = fakeNav({ persist: true });
		await requestPersistence(nav);
		await requestPersistence(nav);
		expect(nav.storage.persist).toHaveBeenCalledTimes(1);
	});
});

describe('persistenceStatus', () => {
	it('maps persisted() to a status', async () => {
		await expect(persistenceStatus(fakeNav({ persisted: true }))).resolves.toBe('granted');
		await expect(persistenceStatus(fakeNav({ persisted: false }))).resolves.toBe('not-granted');
		await expect(persistenceStatus({})).resolves.toBe('not-reported');
	});
});

describe('storageEstimate', () => {
	it('returns usage and quota', async () => {
		const nav = fakeNav({ estimate: { usage: 1536, quota: 6 * 1024 ** 3 } });
		await expect(storageEstimate(nav)).resolves.toEqual({ usage: 1536, quota: 6 * 1024 ** 3 });
	});

	it('returns null when estimate is missing or rejects', async () => {
		await expect(storageEstimate({})).resolves.toBeNull();
		await expect(storageEstimate(fakeNav({ estimate: new Error('nope') }))).resolves.toBeNull();
	});
});

describe('formatBytes', () => {
	it('formats in KB, MB and GB with at most one decimal', () => {
		expect(formatBytes(0)).toBe('0 KB');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(5 * 1024 ** 2)).toBe('5 MB');
		expect(formatBytes(6.4 * 1024 ** 3)).toBe('6.4 GB');
	});
});
