// Test-only helpers for the web Vitest project. NOT imported by app code: it lives under src/lib
// only so `$lib` resolves in tests. Each call returns fully isolated state.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

export type MemoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
	readonly size: number;
	dump(): Record<string, string>;
};

/** Map-backed Storage stand-in (Node 24 has no sessionStorage). */
export function memoryStorage(): MemoryStorage {
	const map = new Map<string, string>();
	return {
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => {
			map.set(key, String(value));
		},
		removeItem: (key) => {
			map.delete(key);
		},
		get size() {
			return map.size;
		},
		dump: () => Object.fromEntries(map)
	};
}

/** A brand-new in-memory IndexedDB per call, so tests never share databases. */
export function freshIdb(): { indexedDB: IDBFactory; IDBKeyRange: typeof IDBKeyRange } {
	return { indexedDB: new IDBFactory(), IDBKeyRange };
}
