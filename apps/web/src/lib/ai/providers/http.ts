/**
 * Shared provider transport: free-function fetch, byte-safe SSE reading, safe JSON and
 * `openStream` (classification + CORS/auth disambiguation). Adapters only map protocols.
 */
import {
	LlmError,
	classifyHttp,
	createSseParser,
	isAbort,
	isFetchTypeError,
	toLlmError,
	type SseEvent
} from '@tran/core/ai';
import type { FetchDeps, ProviderProbe } from '../ports.js';
import { disambiguateFetchFailure } from './test-connection.js';

/**
 * A fetch that is always invoked as a free function (browser fetch throws
 * 'Illegal invocation' with a foreign `this`; RESEARCH Pitfall 3). Without an injected
 * fetch, `globalThis.fetch` is resolved at CALL time, never captured at creation.
 */
export function resolveFetch(deps?: FetchDeps): typeof fetch {
	const injected = deps?.fetch;
	return ((input: RequestInfo | URL, init?: RequestInit) =>
		injected ? injected(input, init) : globalThis.fetch(input, init)) as typeof fetch;
}

/** Bytes → text (UTF-8 split safe) → SSE events. Cancels the reader on abort. */
export async function* readSse(res: Response, signal: AbortSignal): AsyncGenerator<SseEvent> {
	if (!res.body) return;
	const reader = res.body.getReader();
	const dec = new TextDecoder();
	const p = createSseParser();
	try {
		for (;;) {
			if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
			const { value, done } = await reader.read();
			if (done) break;
			yield* p.push(dec.decode(value, { stream: true }));
		}
		yield* p.push(dec.decode());
		yield* p.end();
	} finally {
		if (signal.aborted) await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}

/** Body as JSON when it parses, else the raw text, else undefined. Never throws. */
export async function safeJson(res: Response): Promise<unknown> {
	const t = await res.text().catch(() => '');
	if (!t) return undefined;
	try {
		return JSON.parse(t) as unknown;
	} catch {
		return t;
	}
}

/**
 * POST/GET a generation endpoint and return the OK response. Aborts propagate untouched;
 * a fetch TypeError is disambiguated with a keyed probe (auth / quota / cors-blocked /
 * network); a non-OK status is classified from the body (JSON even under an SSE
 * content-type, as Gemini errors are).
 */
export async function openStream(o: {
	probe: ProviderProbe;
	key: string;
	url: string;
	init: RequestInit;
	deps?: FetchDeps;
}): Promise<Response> {
	const { probe, key, url, init, deps } = o;
	const f = resolveFetch(deps);
	let res: Response;
	try {
		res = await f(url, { credentials: 'omit', cache: 'no-store', ...init });
	} catch (err) {
		if (isAbort(err, init.signal)) throw err;
		if (isFetchTypeError(err, init.signal)) {
			throw new LlmError(await disambiguateFetchFailure(probe, key, deps));
		}
		throw toLlmError(err);
	}
	if (!res.ok) throw classifyHttp(probe.id, res.status, await safeJson(res));
	return res;
}
