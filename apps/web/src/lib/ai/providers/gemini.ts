/**
 * Gemini native `streamGenerateContent?alt=sse` adapter (raw fetch, SSE) and its
 * zero-cost Test connection probe.
 *
 * Key placement (05-RESEARCH Pitfall 10): Google's REST samples put the key in the query
 * string; never copy them. The key travels ONLY in the `x-goog-api-key` header, so it
 * never lands in URLs, history, logs or Referer headers.
 *
 * Consent (05-RESEARCH Pattern 11): the free/paid tier is undetectable from the key, and
 * free-tier content may be used to improve Google's products. Client-data consent is
 * enforced here as well as in the dialog: a client-data prompt without an explicit ack
 * is refused before the key is read or any request is made.
 *
 * Thought parts are never surfaced; billed output counts candidates plus thoughts.
 * Errors never carry provider message text, only sanitized codes.
 */
import { LlmError, type LlmFinish, type LlmUsage } from '@tran/core/ai';
import type { AdapterDeps, LlmEvent, LlmProvider, LlmRequest, ProviderProbe } from '../ports.js';
import { extrasFor, hostFor } from '../models.js';
import { openStream, readSse, safeJson } from './http.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const LIST_URL = `${BASE}/models?pageSize=1000`;
const MAX_PAGES = 5;
const CANARY_MODEL = 'gemini-3.8-flash';

type Loose = Record<string, unknown>;
const rec = (v: unknown): Loose => (typeof v === 'object' && v !== null ? (v as Loose) : {});
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

function safeCode(v: unknown): string | undefined {
	const s = typeof v === 'number' ? String(v) : v;
	return typeof s === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(s) ? s : undefined;
}

const streamUrl = (model: string): string =>
	`${BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

const REFUSED = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']);

function mapFinish(reason: string): LlmFinish {
	if (reason === 'MAX_TOKENS') return 'length';
	if (REFUSED.has(reason)) return 'refused';
	return 'stop';
}

function mapUsage(u: Loose): LlmUsage {
	const thoughts = num(u.thoughtsTokenCount);
	const usage: LlmUsage = {
		outputTokens: (num(u.candidatesTokenCount) ?? 0) + (thoughts ?? 0)
	};
	const input = num(u.promptTokenCount);
	if (input !== undefined) usage.inputTokens = input;
	if (thoughts !== undefined) usage.reasoningTokens = thoughts;
	return usage;
}

async function listPage(key: string, f: typeof fetch, pageToken?: string) {
	const url = pageToken ? `${LIST_URL}&pageToken=${encodeURIComponent(pageToken)}` : LIST_URL;
	const res = await f(url, {
		method: 'GET',
		credentials: 'omit',
		cache: 'no-store',
		headers: { 'x-goog-api-key': key }
	});
	return { status: res.status, body: await safeJson(res) };
}

export const geminiProbe: ProviderProbe = {
	id: 'gemini',
	host: hostFor('gemini'),
	keyCheck: (key, f) => listPage(key, f),
	async modelListed(key, model, f, keyCheck) {
		const wanted = `models/${model}`;
		let body = rec(keyCheck.body);
		for (let page = 1; ; page++) {
			const models = body.models;
			if (!Array.isArray(models)) return page === 1 ? undefined : false;
			if (models.some((m) => rec(m).name === wanted)) return true;
			const next = body.nextPageToken;
			if (typeof next !== 'string' || !next || page >= MAX_PAGES) return false;
			const res = await listPage(key, f, next);
			if (res.status !== 200) return undefined;
			body = rec(res.body);
		}
	},
	async canary(f) {
		// Keyless on purpose: expects a CORS-readable 403 and never spends tokens.
		const res = await f(streamUrl(CANARY_MODEL), {
			method: 'POST',
			credentials: 'omit',
			cache: 'no-store',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		});
		return res.status;
	}
};

export function geminiProvider(deps: AdapterDeps): LlmProvider {
	return {
		id: 'gemini',
		async *stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmEvent> {
			if (req.containsClientData && req.clientDataAck !== true) {
				throw new LlmError('consent-required');
			}
			const key = await deps.getKey();
			if (!key) throw new LlmError('locked');

			const res = await openStream({
				probe: geminiProbe,
				key,
				deps,
				url: streamUrl(req.model),
				init: {
					method: 'POST',
					signal,
					headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
					body: JSON.stringify({
						systemInstruction: { parts: [{ text: req.system }] },
						contents: [{ role: 'user', parts: [{ text: req.user }] }],
						generationConfig: {
							maxOutputTokens: req.maxTokens,
							...extrasFor('gemini', req.model)
						}
					})
				}
			});

			let usage: LlmUsage | undefined;
			for await (const ev of readSse(res, signal)) {
				let chunk: Loose;
				try {
					chunk = rec(JSON.parse(ev.data));
				} catch {
					throw new LlmError('interrupted', { code: 'bad-json' });
				}

				if ('error' in chunk) {
					throw new LlmError('interrupted', { code: safeCode(rec(chunk.error).status) });
				}
				if (chunk.usageMetadata !== undefined) usage = mapUsage(rec(chunk.usageMetadata));

				const candidates = chunk.candidates;
				const cand = Array.isArray(candidates) ? rec(candidates[0]) : undefined;
				let finish: LlmFinish | undefined;

				if (!cand && typeof rec(chunk.promptFeedback).blockReason === 'string') {
					finish = 'refused';
				} else if (cand) {
					const parts = rec(cand.content).parts;
					if (Array.isArray(parts)) {
						for (const raw of parts) {
							const part = rec(raw);
							if (part.thought !== true && typeof part.text === 'string' && part.text) {
								yield { type: 'text', text: part.text };
							}
						}
					}
					if (typeof cand.finishReason === 'string' && cand.finishReason) {
						finish = mapFinish(cand.finishReason);
					}
				}

				if (finish) {
					if (usage) yield { type: 'usage', usage };
					yield { type: 'finish', reason: finish };
					return;
				}
			}
			throw new LlmError('interrupted', { code: 'truncated' });
		}
	};
}
