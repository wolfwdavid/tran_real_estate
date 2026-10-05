import type { LiveProviderId, LlmErrorKind } from './types.js';

/**
 * The one error type the AI layer surfaces. Its message is ALWAYS the kind:
 * provider message text and key material never travel in an LlmError.
 */
export class LlmError extends Error {
	readonly kind: LlmErrorKind;
	readonly status?: number;
	readonly code?: string;

	constructor(kind: LlmErrorKind, opts: { status?: number; code?: string } = {}) {
		super(kind);
		this.name = 'LlmError';
		this.kind = kind;
		this.status = opts.status;
		this.code = opts.code;
	}
}

type Loose = Record<string, unknown>;

const isRecord = (v: unknown): v is Loose => typeof v === 'object' && v !== null;

/** `body.error` when present, else the body itself, as a loose record. */
function errObj(body: unknown): Loose {
	if (isRecord(body) && 'error' in body) {
		const e = body.error;
		return isRecord(e) ? e : {};
	}
	return isRecord(body) ? body : {};
}

function msg(body: unknown): string {
	if (typeof body === 'string') return body;
	const m = errObj(body).message;
	return typeof m === 'string' ? m : '';
}

function details(err: Loose): Loose[] {
	return Array.isArray(err.details) ? err.details.filter(isRecord) : [];
}

const CODE_RE = /^[A-Za-z0-9_.-]{1,64}$/;

function codeOf(err: Loose): string | undefined {
	const candidates = [err.type, err.code, err.status, details(err)[0]?.reason];
	for (const c of candidates) {
		const s = typeof c === 'number' ? String(c) : c;
		if (typeof s === 'string' && CODE_RE.test(s)) return s;
	}
	return undefined;
}

function kindOf(provider: LiveProviderId, status: number, body: unknown): LlmErrorKind {
	const err = errObj(body);
	const m = msg(body);

	// 1. auth
	if (status === 401 || status === 403) return 'auth';
	if (
		provider === 'gemini' &&
		status === 400 &&
		(details(err).some((d) => d.reason === 'API_KEY_INVALID') || /API key not valid/i.test(m))
	) {
		return 'auth';
	}

	// 2. quota
	if (status === 429 || status === 402) return 'quota';
	if (status === 400 && /spend limit|credit balance/i.test(m)) return 'quota';
	if (err.status === 'RESOURCE_EXHAUSTED') return 'quota';

	// 3. model-not-found
	if (status === 404) return 'model-not-found';
	if (status === 400 && (err.param === 'model' || /\bmodel\b/i.test(m))) return 'model-not-found';

	// 4. everything else (5xx, 529 overloaded, unknown 4xx)
	return 'interrupted';
}

/** Map a non-OK HTTP response (status + parsed body, or raw text) to an LlmError. */
export function classifyHttp(provider: LiveProviderId, status: number, body: unknown): LlmError {
	return new LlmError(kindOf(provider, status, body), { status, code: codeOf(errObj(body)) });
}

/** True when the failure is a user/caller abort (never shown as an error). */
export function isAbort(err: unknown, signal?: { aborted: boolean } | null): boolean {
	return (
		signal?.aborted === true ||
		(typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError')
	);
}

/** True for the opaque fetch TypeError a browser throws on CORS or network failure. */
export function isFetchTypeError(err: unknown, signal?: { aborted: boolean } | null): boolean {
	return err instanceof TypeError && !isAbort(err, signal);
}

/** Normalise any thrown value into an LlmError without echoing its message. */
export function toLlmError(err: unknown, signal?: { aborted: boolean } | null): LlmError {
	if (err instanceof LlmError) return err;
	if (isAbort(err, signal)) return new LlmError('aborted');
	if (isFetchTypeError(err, signal)) return new LlmError('network');
	return new LlmError('interrupted');
}
