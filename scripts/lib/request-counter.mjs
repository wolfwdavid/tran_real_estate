// Pure request counter for the Pages emulator (scripts/serve-pages.mjs, opt-in measurement).

/**
 * Counts read requests only (GET and HEAD): the smoke suite is read-only.
 * byPath keys are `<port> <pathname>`; the caller passes the pathname, and any query is dropped
 * here too because version.json polls carry a cache-busting query.
 */
export function createRequestCounter() {
	let total = 0;
	/** @type {Record<string, number>} */
	const byPort = {};
	/** @type {Record<string, number>} */
	const byPath = {};
	return {
		/**
		 * @param {number | string} port
		 * @param {string | undefined} method
		 * @param {string} pathname
		 */
		record(port, method, pathname) {
			if (method !== 'GET' && method !== 'HEAD') return;
			const key = `${port} ${pathname.split('?')[0]}`;
			total += 1;
			byPort[port] = (byPort[port] ?? 0) + 1;
			byPath[key] = (byPath[key] ?? 0) + 1;
		},
		snapshot() {
			return { total, byPort: { ...byPort }, byPath: { ...byPath } };
		}
	};
}
