// Shared E2E helpers for the Phase 5 AI layer (05-15). A plain module, not a spec.
//
// No AI provider is ever reached: every spec calls blockAiProviders(page) first, which aborts any
// request to the four provider hosts. routeAnthropic / routeOpenAI / routeGemini / routeOpenRouter
// replace that with canned answers for one host and return the live list of requests they served.
// Unhandled paths still abort, so a real call cannot happen even if a mock forgets a case.
//
// RESEARCH Pitfall 8: a routed cross-origin response still needs `access-control-allow-origin`
// for the page's fetch to read it, so every fulfill carries CORS. `route.fulfill` hands the whole
// SSE body over at once, so Stop-mid-stream is tested with the keyless Fixture provider instead.
import { expect, type Page, type Request, type Route } from '@playwright/test';

export { fakeKey } from '../../support/fake-keys';

const CORS = { 'access-control-allow-origin': '*' };
const PREFLIGHT = {
	...CORS,
	'access-control-allow-methods': 'GET, POST',
	'access-control-allow-headers': '*'
};
const SSE = { ...CORS, 'content-type': 'text/event-stream; charset=utf-8' };
const JSON_HEADERS = { ...CORS, 'content-type': 'application/json' };

export const AI_HOSTS = {
	anthropic: 'https://api.anthropic.com',
	openai: 'https://api.openai.com',
	gemini: 'https://generativelanguage.googleapis.com',
	openrouter: 'https://openrouter.ai'
} as const;

export type AiProviderId = keyof typeof AI_HOSTS;

const hostPattern = (id: AiProviderId) => new RegExp(`^${AI_HOSTS[id].replace(/[.]/g, '\\.')}/`);

/** Aborts every request to the four AI provider hosts. Call before any navigation. */
export async function blockAiProviders(page: Page): Promise<void> {
	for (const id of Object.keys(AI_HOSTS) as AiProviderId[]) {
		await page.route(hostPattern(id), (route) => route.abort('failed'));
	}
}

// ---- SSE bodies (05-15 PLAN <context>) ----

/** Joins complete SSE frames (each already ends with a blank line). */
export function sse(frames: string[]): string {
	return frames.join('');
}

/** Splits `text` into at most `n` consecutive chunks that concatenate back to it exactly. */
function chunks(text: string, n = 4): string[] {
	const size = Math.max(1, Math.ceil(text.length / n));
	const out: string[] = [];
	for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
	return out;
}

const data = (v: unknown) => `data: ${JSON.stringify(v)}\n\n`;
const event = (name: string, v: unknown) => `event: ${name}\n${data(v)}`;

export function anthropicSse(text: string, n = 4): string {
	return sse([
		event('message_start', { type: 'message_start', message: { usage: { input_tokens: 120 } } }),
		...chunks(text, n).map((t) =>
			event('content_block_delta', {
				type: 'content_block_delta',
				index: 0,
				delta: { type: 'text_delta', text: t }
			})
		),
		event('message_delta', {
			type: 'message_delta',
			delta: { stop_reason: 'end_turn' },
			usage: { output_tokens: 42 }
		}),
		event('message_stop', { type: 'message_stop' })
	]);
}

export function openaiSse(text: string, n = 4): string {
	return sse([
		...chunks(text, n).map((t) => data({ type: 'response.output_text.delta', delta: t })),
		data({
			type: 'response.completed',
			response: { usage: { input_tokens: 120, output_tokens: 42 } }
		})
	]);
}

export function geminiSse(text: string, n = 4): string {
	return sse([
		...chunks(text, n).map((t) => data({ candidates: [{ content: { parts: [{ text: t }] } }] })),
		data({
			candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
			usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 42 }
		})
	]);
}

export function openrouterSse(text: string, n = 4): string {
	return sse([
		...chunks(text, n).map((t) => data({ choices: [{ delta: { content: t } }] })),
		data({
			choices: [{ delta: {}, finish_reason: 'stop' }],
			usage: { prompt_tokens: 120, completion_tokens: 42, cost: 0.0007 }
		}),
		'data: [DONE]\n\n'
	]);
}

// ---- Provider routes ----

export interface AiMockOptions {
	/** Generation answer for a keyed request: SSE text, or 'abort' (a CORS block / network failure). */
	stream?: string | 'abort';
	/** Status of the keyed models / key-check endpoint. Default 200. */
	modelsStatus?: number;
	/** Body for a non-200 models answer. */
	modelsError?: unknown;
	/** Model ids the models endpoint lists. */
	models?: string[];
	/** Status of the keyless canary on the generation endpoint. Default 401 (CORS-readable). */
	canaryStatus?: number;
}

export interface AiCall {
	method: string;
	url: URL;
	/** Lower-cased header names (Playwright's request.headers()). */
	headers: Record<string, string>;
	/** 'generate' (keyed), 'canary' (keyless generation), 'models', 'key' or 'other'. */
	kind: 'generate' | 'canary' | 'models' | 'key' | 'other';
}

type Classify = (url: URL, headers: Record<string, string>, method: string) => AiCall['kind'];

async function routeProvider(
	page: Page,
	id: AiProviderId,
	o: AiMockOptions,
	classify: Classify,
	bodies: { stream: (text: string) => string; models: (ids: string[]) => unknown }
): Promise<AiCall[]> {
	const calls: AiCall[] = [];
	await page.route(hostPattern(id), async (route: Route) => {
		const request: Request = route.request();
		const method = request.method();
		if (method === 'OPTIONS') {
			await route.fulfill({ status: 204, headers: PREFLIGHT });
			return;
		}
		const url = new URL(request.url());
		const headers = request.headers();
		const kind = classify(url, headers, method);
		calls.push({ method, url, headers, kind });

		switch (kind) {
			case 'generate':
				if (o.stream === undefined || o.stream === 'abort') {
					await route.abort('failed');
					return;
				}
				await route.fulfill({ status: 200, headers: SSE, body: bodies.stream(o.stream) });
				return;
			case 'canary':
				await route.fulfill({
					status: o.canaryStatus ?? 401,
					headers: JSON_HEADERS,
					body: JSON.stringify({ error: { type: 'authentication_error' } })
				});
				return;
			case 'models':
			case 'key': {
				const status = o.modelsStatus ?? 200;
				const body =
					status === 200
						? kind === 'key'
							? { data: { label: 'mock' } }
							: bodies.models(o.models ?? [])
						: (o.modelsError ?? { error: { code: 'invalid_api_key' } });
				await route.fulfill({ status, headers: JSON_HEADERS, body: JSON.stringify(body) });
				return;
			}
			default:
				await route.abort('failed');
		}
	});
	return calls;
}

/** api.anthropic.com: POST /v1/messages (keyed stream or keyless canary), GET /v1/models. */
export function routeAnthropic(page: Page, o: AiMockOptions = {}): Promise<AiCall[]> {
	return routeProvider(
		page,
		'anthropic',
		o,
		(url, h, method) => {
			if (method === 'POST' && url.pathname === '/v1/messages')
				return h['x-api-key'] ? 'generate' : 'canary';
			if (method === 'GET' && url.pathname === '/v1/models') return 'models';
			return 'other';
		},
		{ stream: anthropicSse, models: (ids) => ({ data: ids.map((id) => ({ id })) }) }
	);
}

/** api.openai.com: POST /v1/responses (keyed stream or keyless canary), GET /v1/models. */
export function routeOpenAI(page: Page, o: AiMockOptions = {}): Promise<AiCall[]> {
	return routeProvider(
		page,
		'openai',
		o,
		(url, h, method) => {
			if (method === 'POST' && url.pathname === '/v1/responses')
				return h.authorization ? 'generate' : 'canary';
			if (method === 'GET' && url.pathname === '/v1/models') return 'models';
			return 'other';
		},
		{ stream: openaiSse, models: (ids) => ({ data: ids.map((id) => ({ id })) }) }
	);
}

/** generativelanguage.googleapis.com: POST :streamGenerateContent, GET /v1beta/models. */
export function routeGemini(page: Page, o: AiMockOptions = {}): Promise<AiCall[]> {
	return routeProvider(
		page,
		'gemini',
		o,
		(url, h, method) => {
			if (method === 'POST' && url.pathname.endsWith(':streamGenerateContent'))
				return h['x-goog-api-key'] ? 'generate' : 'canary';
			if (method === 'GET' && url.pathname === '/v1beta/models') return 'models';
			return 'other';
		},
		{
			stream: geminiSse,
			models: (ids) => ({ models: ids.map((id) => ({ name: `models/${id}` })) })
		}
	);
}

/** openrouter.ai: POST /api/v1/chat/completions, GET /api/v1/key (keyed), GET /api/v1/models. */
export function routeOpenRouter(page: Page, o: AiMockOptions = {}): Promise<AiCall[]> {
	return routeProvider(
		page,
		'openrouter',
		o,
		(url, h, method) => {
			if (method === 'POST' && url.pathname === '/api/v1/chat/completions')
				return h.authorization ? 'generate' : 'canary';
			if (method === 'GET' && url.pathname === '/api/v1/key') return 'key';
			if (method === 'GET' && url.pathname === '/api/v1/models') return 'models';
			return 'other';
		},
		{ stream: openrouterSse, models: (ids) => ({ data: ids.map((id) => ({ id })) }) }
	);
}

// ---- Page helpers ----

/** Opens Settings and waits for the page and the AI drafting section to finish hydrating. */
export async function openAiSettings(page: Page): Promise<void> {
	await page.goto('settings/');
	await expect(page.locator('[data-settings-page][data-hydrated="true"]')).toBeAttached();
	await expect(page.locator('#ai-drafting[data-ai-ready="true"]')).toBeAttached();
}

/** Saves a key through the provider's real Settings card and waits for the saved summary. */
export async function saveKey(page: Page, providerLabel: string, key: string): Promise<void> {
	const id = (Object.keys(AI_HOSTS) as AiProviderId[]).find(
		(p) => providerLabel.toLowerCase().replace(/^google /, '') === p
	);
	const card = id ? page.locator(`#key-${id}`) : page;
	await card.getByLabel(`${providerLabel} API key`, { exact: true }).fill(key);
	await card.getByRole('button', { name: 'Save key', exact: true }).click();
	if (id) await expect(card.getByText('Key ending in')).toBeVisible();
}

/** A live list of every request URL the page makes whose URL contains `hostSubstring`. */
export function countRequests(page: Page, hostSubstring: string): { readonly count: number } {
	const seen: string[] = [];
	page.on('request', (r) => {
		if (r.url().includes(hostSubstring)) seen.push(r.url());
	});
	return {
		get count() {
			return seen.length;
		}
	};
}
