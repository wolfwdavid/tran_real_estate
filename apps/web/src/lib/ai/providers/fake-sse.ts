/**
 * Test-only helper. Production code must never import this file (enforced by
 * apps/web/src/lib/ai/no-auto-send.test.ts in plan 05-10).
 *
 * Fake `fetch` implementations backed by in-memory `ReadableStream`s, so provider tests
 * never touch the network (tooling/vitest/no-network.ts keeps the real fetch blocked).
 */

type Call = { url: string; init: RequestInit };

function urlOf(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

const abortError = () => new DOMException('Aborted', 'AbortError');

/**
 * A fetch that answers every call with an SSE body made of `frames`.
 * - `splitEvery`: chunk size (characters, or bytes when `bytes` is true). Default: one chunk.
 * - `bytes`: split the ENCODED bytes, so multi-byte UTF-8 characters straddle chunks.
 * - `holdOpen`: never close the stream (for Stop / abort tests).
 */
export function fakeSseFetch(
	frames: string[],
	o: {
		status?: number;
		headers?: Record<string, string>;
		splitEvery?: number;
		holdOpen?: boolean;
		bytes?: boolean;
	} = {}
): { fetchImpl: typeof fetch; calls: Call[] } {
	const calls: Call[] = [];
	const enc = new TextEncoder();

	const chunks = (): Uint8Array[] => {
		const text = frames.join('');
		const out: Uint8Array[] = [];
		if (o.bytes) {
			const all = enc.encode(text);
			const step = Math.max(1, o.splitEvery ?? all.length);
			for (let i = 0; i < all.length; i += step) out.push(all.slice(i, i + step));
		} else {
			const chars = Array.from(text);
			const step = Math.max(1, o.splitEvery ?? chars.length);
			for (let i = 0; i < chars.length; i += step) {
				out.push(enc.encode(chars.slice(i, i + step).join('')));
			}
		}
		return out;
	};

	const fetchImpl = async (input: RequestInfo | URL, init: RequestInit = {}) => {
		calls.push({ url: urlOf(input), init });
		const signal = init.signal;
		if (signal?.aborted) throw abortError();
		const body = new ReadableStream<Uint8Array>({
			start(ctrl) {
				signal?.addEventListener('abort', () => {
					try {
						ctrl.error(abortError());
					} catch {
						// stream already closed
					}
				});
				for (const c of chunks()) ctrl.enqueue(c);
				if (!o.holdOpen) ctrl.close();
			}
		});
		return new Response(body, {
			status: o.status ?? 200,
			headers: { 'content-type': 'text/event-stream', ...o.headers }
		});
	};
	return { fetchImpl: fetchImpl as typeof fetch, calls };
}

export type FakeRoute = {
	match: (url: string, init: RequestInit) => boolean;
	respond: 'typeerror' | { status: number; body?: unknown; headers?: Record<string, string> };
};

/**
 * A fetch that answers from a route table: the first matching route wins. `'typeerror'`
 * simulates a CORS block / network failure (`TypeError('Failed to fetch')`).
 */
export function fakeRouteFetch(routes: FakeRoute[]): { fetchImpl: typeof fetch; calls: Call[] } {
	const calls: Call[] = [];
	const fetchImpl = async (input: RequestInfo | URL, init: RequestInit = {}) => {
		const url = urlOf(input);
		calls.push({ url, init });
		if (init.signal?.aborted) throw abortError();
		const route = routes.find((r) => r.match(url, init));
		if (!route) throw new Error(`fakeRouteFetch: no route for ${url}`);
		if (route.respond === 'typeerror') throw new TypeError('Failed to fetch');
		const { status, body, headers } = route.respond;
		const payload =
			body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
		return new Response(payload, {
			status,
			headers: { 'content-type': 'application/json', ...headers }
		});
	};
	return { fetchImpl: fetchImpl as typeof fetch, calls };
}
