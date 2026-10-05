/**
 * Anthropic Messages adapter (raw fetch, SSE) and its zero-cost Test connection probe.
 *
 * Every request to api.anthropic.com carries `anthropic-version` and
 * `anthropic-dangerous-direct-browser-access: true`. Without the latter the API refuses
 * the browser preflight, which would surface as a fake CORS block.
 *
 * Errors never carry provider message text: mid-stream failures become
 * `LlmError('interrupted', { code })` with a sanitized code only.
 */
import { LlmError, type LlmFinish } from '@tran/core/ai';
import type { AdapterDeps, LlmEvent, LlmProvider, LlmRequest, ProviderProbe } from '../ports.js';
import { extrasFor, hostFor } from '../models.js';
import { openStream, readSse, safeJson } from './http.js';

const BASE = 'https://api.anthropic.com';
const COMMON = {
	'anthropic-version': '2023-06-01',
	'anthropic-dangerous-direct-browser-access': 'true'
} as const;

type Loose = Record<string, unknown>;
const rec = (v: unknown): Loose => (typeof v === 'object' && v !== null ? (v as Loose) : {});
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

function safeCode(v: unknown): string | undefined {
	return typeof v === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(v) ? v : undefined;
}

function mapStop(reason: string): LlmFinish {
	if (reason === 'max_tokens') return 'length';
	if (reason === 'refusal') return 'refused';
	return 'stop';
}

export const anthropicProbe: ProviderProbe = {
	id: 'anthropic',
	host: hostFor('anthropic'),
	async keyCheck(key, f) {
		const res = await f(`${BASE}/v1/models?limit=1000`, {
			method: 'GET',
			credentials: 'omit',
			cache: 'no-store',
			headers: { 'x-api-key': key, ...COMMON }
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
		const res = await f(`${BASE}/v1/messages`, {
			method: 'POST',
			credentials: 'omit',
			cache: 'no-store',
			headers: { 'content-type': 'application/json', ...COMMON },
			body: '{}'
		});
		return res.status;
	}
};

export function anthropicProvider(deps: AdapterDeps): LlmProvider {
	return {
		id: 'anthropic',
		async *stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmEvent> {
			const key = await deps.getKey();
			if (!key) throw new LlmError('locked');
			const res = await openStream({
				probe: anthropicProbe,
				key,
				deps,
				url: `${BASE}/v1/messages`,
				init: {
					method: 'POST',
					signal,
					headers: { 'content-type': 'application/json', 'x-api-key': key, ...COMMON },
					body: JSON.stringify({
						model: req.model,
						max_tokens: req.maxTokens,
						system: req.system,
						messages: [{ role: 'user', content: req.user }],
						stream: true,
						...extrasFor('anthropic', req.model)
					})
				}
			});

			let terminal = false;
			for await (const { data } of readSse(res, signal)) {
				let ev: Loose;
				try {
					ev = rec(JSON.parse(data));
				} catch {
					throw new LlmError('interrupted', { code: 'bad-json' });
				}
				switch (ev.type) {
					case 'message_start': {
						const input = num(rec(rec(ev.message).usage).input_tokens);
						if (input !== undefined) yield { type: 'usage', usage: { inputTokens: input } };
						break;
					}
					case 'content_block_delta': {
						// Only visible text; thinking/signature/tool-input deltas are never shown.
						const delta = rec(ev.delta);
						if (delta.type === 'text_delta' && typeof delta.text === 'string') {
							yield { type: 'text', text: delta.text };
						}
						break;
					}
					case 'message_delta': {
						const output = num(rec(ev.usage).output_tokens);
						if (output !== undefined) yield { type: 'usage', usage: { outputTokens: output } };
						const stop = rec(ev.delta).stop_reason;
						if (typeof stop === 'string') yield { type: 'finish', reason: mapStop(stop) };
						break;
					}
					case 'message_stop':
						terminal = true;
						break;
					case 'error':
						throw new LlmError('interrupted', { code: safeCode(rec(ev.error).type) });
					default:
						// ping, content_block_start/stop and future event types
						break;
				}
				if (terminal) break;
			}
			if (!terminal) throw new LlmError('interrupted', { code: 'truncated' });
		}
	};
}
