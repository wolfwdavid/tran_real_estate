// Production fallback used when sessionStorage access throws (storage blocked by the browser).
// Keys then live only in this page's memory and vanish on reload. Same shape as the test helper,
// but app code must never import test-utils.

export type MemoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
	readonly size: number;
};

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
		}
	};
}
