/**
 * OpenRouter chat-completions streaming adapter (raw fetch, SSE) and its zero-cost
 * Test connection probe.
 *
 * OpenRouter is the CORS-stable fallback. provider.data_collection 'deny' routes only to
 * providers that do not collect prompts; a 404 'no endpoints' is surfaced as
 * model-not-found.
 *
 * Usage carries the provider-reported USD cost, which wins over registry estimates.
 * An error delivered as a chunk of a 200 stream is reported, never treated as an empty
 * draft. The public models list answers 200 without a key, so the key is validated
 * against /api/v1/key instead. Errors never carry provider message text.
 */
import { LlmError, type LlmFinish, type LlmUsage } from '@tran/core/ai';
import type { AdapterDeps, LlmEvent, LlmProvider, LlmRequest, ProviderProbe } from '../ports.js';
import { extrasFor, hostFor } from '../models.js';
import { openStream, readSse, safeJson } from './http.js';

const BASE = 'https://openrouter.ai/api/v1';
const CHAT_URL = `${BASE}/chat/completions`;
const TITLE = 'Tran Real Estate Tools';

type Loose = Record<string, unknown>;
const rec = (v: unknown): Loose => (typeof v === 'object' && v !== null ? (v as Loose) : {});
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

function safeCode(v: unknown): string | undefined {
	const s = typeof v === 'number' ? String(v) : v;
	return typeof s === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(s) ? s : undefined;
}

function mapUsage(u: Loose): LlmUsage {
	const usage: LlmUsage = {};
	const input = num(u.prompt_tokens);
	const output = num(u.completion_tokens);
	const cost = num(u.cost);
	if (input !== undefined) usage.inputTokens = input;
	if (output !== undefined) usage.outputTokens = output;
	if (cost !== undefined) usage.costUsd = cost;
	return usage;
}

export const openrouterProbe: ProviderProbe = {
	id: 'openrouter',
	host: hostFor('openrouter'),
	async keyCheck(key, f) {
		const res = await f(`${BASE}/key`, {
			method: 'GET',
			credentials: 'omit',
			cache: 'no-store',
			headers: { authorization: `Bearer ${key}` }
		});
		return { status: res.status, body: await safeJson(res) };
	},
	async modelListed(_key, model, f) {
		// Public list: deliberately sent without the key.
		const res = await f(`${BASE}/models`, {
			method: 'GET',
			credentials: 'omit',
			cache: 'no-store'
		});
		if (res.status !== 200) return undefined;
		const data = rec(await safeJson(res)).data;
		if (!Array.isArray(data)) return undefined;
		return data.some((m) => rec(m).id === model);
	},
	async canary(f) {
		// Keyless on purpose: expects a CORS-readable 401 and never spends credits.
		const res = await f(CHAT_URL, {
			method: 'POST',
			credentials: 'omit',
			cache: 'no-store',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		});
		return res.status;
	}
};

export function openrouterProvider(deps: AdapterDeps): LlmProvider {
	return {
		id: 'openrouter',
		async *stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmEvent> {
			const key = await deps.getKey();
			if (!key) throw new LlmError('locked');

			const res = await openStream({
				probe: openrouterProbe,
				key,
				deps,
				url: CHAT_URL,
				init: {
					method: 'POST',
					signal,
					headers: {
						authorization: `Bearer ${key}`,
						'content-type': 'application/json',
						'x-openrouter-title': TITLE
					},
					body: JSON.stringify({
						model: req.model,
						messages: [
							{ role: 'system', content: req.system },
							{ role: 'user', content: req.user }
						],
						max_tokens: req.maxTokens,
						stream: true,
						provider: { data_collection: 'deny' },
						...extrasFor('openrouter', req.model)
					})
				}
			});

			let finished = false;
			for await (const ev of readSse(res, signal)) {
				if (ev.data === '[DONE]') {
					if (!finished) break;
					return;
				}
				let chunk: Loose;
				try {
					chunk = rec(JSON.parse(ev.data));
				} catch {
					throw new LlmError('interrupted', { code: 'bad-json' });
				}

				if ('error' in chunk) {
					throw new LlmError('interrupted', { code: safeCode(rec(chunk.error).code) });
				}

				const choices = chunk.choices;
				const choice = Array.isArray(choices) ? rec(choices[0]) : {};
				const content = rec(choice.delta).content;
				if (typeof content === 'string' && content) yield { type: 'text', text: content };

				const fr = choice.finish_reason;
				if (typeof fr === 'string' && fr && !finished) {
					if (fr === 'error') throw new LlmError('interrupted', { code: 'finish-error' });
					const reason: LlmFinish =
						fr === 'length' ? 'length' : fr === 'content_filter' ? 'refused' : 'stop';
					finished = true;
					yield { type: 'finish', reason };
				}

				if (chunk.usage !== undefined && chunk.usage !== null) {
					yield { type: 'usage', usage: mapUsage(rec(chunk.usage)) };
				}
			}
			if (!finished) throw new LlmError('interrupted', { code: 'truncated' });
		}
	};
}
