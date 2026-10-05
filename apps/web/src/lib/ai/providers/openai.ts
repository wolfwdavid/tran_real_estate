/**
 * OpenAI Responses API adapter (raw fetch, SSE) and its zero-cost Test connection probe.
 *
 * OpenAI's generation endpoints answer a wrong key with 401 WITHOUT
 * Access-Control-Allow-Origin (verified live 2026-10-04), so the browser sees a TypeError.
 * openStream re-checks via GET /v1/models before reporting a CORS block.
 *
 * Generation always sends `store: false` so drafts are not retained server-side for
 * later retrieval. Errors never carry provider message text.
 */
import { LlmError, type LlmFinish, type LlmUsage } from '@tran/core/ai';
import type { AdapterDeps, LlmEvent, LlmProvider, LlmRequest, ProviderProbe } from '../ports.js';
import { extrasFor, hostFor } from '../models.js';
import { openStream, readSse, safeJson } from './http.js';

const BASE = 'https://api.openai.com';

type Loose = Record<string, unknown>;
const rec = (v: unknown): Loose => (typeof v === 'object' && v !== null ? (v as Loose) : {});
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

function safeCode(v: unknown): string | undefined {
	return typeof v === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(v) ? v : undefined;
}

/** `output_tokens` already includes reasoning tokens (billed output); never add them twice. */
function usageOf(raw: unknown): LlmUsage | undefined {
	const u = rec(raw);
	const usage: LlmUsage = {};
	const input = num(u.input_tokens);
	const output = num(u.output_tokens);
	const reasoning = num(rec(u.output_tokens_details).reasoning_tokens);
	if (input !== undefined) usage.inputTokens = input;
	if (output !== undefined) usage.outputTokens = output;
	if (reasoning !== undefined) usage.reasoningTokens = reasoning;
	return Object.keys(usage).length > 0 ? usage : undefined;
}

/** Unknown incomplete reasons still mean the output was cut short. */
function incompleteFinish(reason: unknown): LlmFinish {
	return reason === 'content_filter' ? 'refused' : 'length';
}

export const openaiProbe: ProviderProbe = {
	id: 'openai',
	host: hostFor('openai'),
	async keyCheck(key, f) {
		const res = await f(`${BASE}/v1/models`, {
			method: 'GET',
			credentials: 'omit',
			cache: 'no-store',
			headers: { authorization: `Bearer ${key}` }
		});
		return { status: res.status, body: await safeJson(res) };
	},
	async modelListed(_key, model, _f, keyCheck) {
		const data = rec(keyCheck.body).data;
		if (!Array.isArray(data)) return undefined;
		return data.some((m) => rec(m).id === model);
	},
	async canary(f) {
		// Keyless on purpose: expects a CORS-readable 401 and never spends tokens.
		const res = await f(`${BASE}/v1/responses`, {
			method: 'POST',
			credentials: 'omit',
			cache: 'no-store',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		});
		return res.status;
	}
};

export function openaiProvider(deps: AdapterDeps): LlmProvider {
	return {
		id: 'openai',
		async *stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmEvent> {
			const key = await deps.getKey();
			if (!key) throw new LlmError('locked');
			const res = await openStream({
				probe: openaiProbe,
				key,
				deps,
				url: `${BASE}/v1/responses`,
				init: {
					method: 'POST',
					signal,
					headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
					body: JSON.stringify({
						model: req.model,
						instructions: req.system,
						input: req.user,
						max_output_tokens: req.maxTokens,
						stream: true,
						store: false,
						...extrasFor('openai', req.model)
					})
				}
			});

			let terminal = false;
			let finished = false;
			for await (const { data } of readSse(res, signal)) {
				let ev: Loose;
				try {
					ev = rec(JSON.parse(data));
				} catch {
					throw new LlmError('interrupted', { code: 'bad-json' });
				}
				switch (ev.type) {
					case 'response.output_text.delta':
						if (typeof ev.delta === 'string') yield { type: 'text', text: ev.delta };
						break;
					case 'response.refusal.delta':
						// The refusal text itself is never shown.
						if (!finished) {
							finished = true;
							yield { type: 'finish', reason: 'refused' };
						}
						break;
					case 'response.completed': {
						const usage = usageOf(rec(ev.response).usage);
						if (usage) yield { type: 'usage', usage };
						if (!finished) {
							finished = true;
							yield { type: 'finish', reason: 'stop' };
						}
						terminal = true;
						break;
					}
					case 'response.incomplete': {
						const r = rec(ev.response);
						const usage = usageOf(r.usage);
						if (usage) yield { type: 'usage', usage };
						if (!finished) {
							finished = true;
							yield {
								type: 'finish',
								reason: incompleteFinish(rec(r.incomplete_details).reason)
							};
						}
						terminal = true;
						break;
					}
					case 'error':
						throw new LlmError('interrupted', {
							code: safeCode(ev.code) ?? safeCode(rec(ev.error).code)
						});
					case 'response.failed':
						throw new LlmError('interrupted', {
							code: safeCode(rec(rec(ev.response).error).code)
						});
					default:
						// response.created / in_progress / output_item.* / content_part.* /
						// reasoning_summary_text.* and future event types
						break;
				}
				if (terminal) break;
			}
			if (!terminal) throw new LlmError('interrupted', { code: 'truncated' });
		}
	};
}
