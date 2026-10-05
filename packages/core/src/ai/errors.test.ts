import { describe, expect, test } from 'vitest';

import { LlmError, classifyHttp, isAbort, isFetchTypeError, toLlmError } from './errors.js';
import type { LiveProviderId, LlmErrorKind } from './types.js';

type Row = [LiveProviderId, number, unknown, LlmErrorKind];

const ROWS: Row[] = [
	// auth
	[
		'anthropic',
		401,
		{ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
		'auth'
	],
	['anthropic', 403, { type: 'error', error: { type: 'permission_error' } }, 'auth'],
	[
		'openai',
		401,
		{ error: { code: 'invalid_api_key', message: 'Incorrect API key provided' } },
		'auth'
	],
	['openrouter', 401, { error: { code: 401, message: 'No auth credentials found' } }, 'auth'],
	[
		'gemini',
		400,
		{
			error: {
				code: 400,
				status: 'INVALID_ARGUMENT',
				message: 'API key not valid. Please pass a valid API key.',
				details: [{ reason: 'API_KEY_INVALID' }]
			}
		},
		'auth'
	],
	[
		'gemini',
		400,
		{ error: { message: 'API key not valid. Please pass a valid API key.' } },
		'auth'
	],
	['gemini', 403, { error: { code: 403, status: 'PERMISSION_DENIED' } }, 'auth'],
	['openai', 401, 'Unauthorized', 'auth'],
	// quota
	['openai', 429, { error: { code: 'insufficient_quota' } }, 'quota'],
	['anthropic', 429, { error: { type: 'rate_limit_error' } }, 'quota'],
	['anthropic', 402, { error: { type: 'billing_error' } }, 'quota'],
	['openrouter', 402, { error: { code: 402, message: 'Insufficient credits' } }, 'quota'],
	[
		'anthropic',
		400,
		{
			error: {
				type: 'invalid_request_error',
				message: 'You have reached your specified workspace spend limit.'
			}
		},
		'quota'
	],
	[
		'anthropic',
		400,
		{
			error: {
				type: 'invalid_request_error',
				message: 'Your credit balance is too low to access the Anthropic API.'
			}
		},
		'quota'
	],
	['gemini', 429, { error: { status: 'RESOURCE_EXHAUSTED' } }, 'quota'],
	// model-not-found
	['openai', 404, { error: { code: 'model_not_found', param: 'model' } }, 'model-not-found'],
	['openrouter', 400, { error: { message: 'Invalid model specified' } }, 'model-not-found'],
	[
		'openrouter',
		404,
		{ error: { message: 'No endpoints found matching your data policy' } },
		'model-not-found'
	],
	[
		'gemini',
		404,
		{ error: { status: 'NOT_FOUND', message: 'models/x is not found' } },
		'model-not-found'
	],
	// interrupted
	['anthropic', 529, { error: { type: 'overloaded_error' } }, 'interrupted'],
	['openai', 500, {}, 'interrupted'],
	['openai', 502, undefined, 'interrupted'],
	['gemini', 503, null, 'interrupted'],
	[
		'anthropic',
		400,
		{ error: { type: 'invalid_request_error', message: 'max_tokens: Field required' } },
		'interrupted'
	]
];

const SECRET_TEXT = ['spend limit', 'credit balance', 'API key not valid', 'invalid x-api-key'];

describe('classifyHttp', () => {
	test.each(ROWS)('%s %i -> %#', (provider, status, body, kind) => {
		expect(classifyHttp(provider, status, body).kind).toBe(kind);
	});

	test.each(ROWS)('%s %i returns a clean LlmError', (provider, status, body, kind) => {
		const e = classifyHttp(provider, status, body);
		expect(e).toBeInstanceOf(LlmError);
		expect(e).toBeInstanceOf(Error);
		expect(e.name).toBe('LlmError');
		expect(e.message).toBe(kind);
		expect(e.status).toBe(status);
		const serialized = JSON.stringify({ m: e.message, c: e.code });
		for (const s of SECRET_TEXT) expect(serialized).not.toContain(s);
	});

	test('code prefers error.type', () => {
		expect(
			classifyHttp('anthropic', 401, {
				type: 'error',
				error: { type: 'authentication_error', message: 'invalid x-api-key' }
			}).code
		).toBe('authentication_error');
	});

	test('code falls back to error.code, stringifying numbers', () => {
		expect(classifyHttp('openai', 429, { error: { code: 'insufficient_quota' } }).code).toBe(
			'insufficient_quota'
		);
		expect(classifyHttp('openrouter', 402, { error: { code: 402 } }).code).toBe('402');
	});

	test('code falls back to error.status then details[0].reason', () => {
		expect(classifyHttp('gemini', 429, { error: { status: 'RESOURCE_EXHAUSTED' } }).code).toBe(
			'RESOURCE_EXHAUSTED'
		);
		expect(
			classifyHttp('gemini', 400, {
				error: { message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] }
			}).code
		).toBe('API_KEY_INVALID');
	});

	test('code skips values that are not short identifiers', () => {
		expect(
			classifyHttp('openai', 401, { error: { code: 'has spaces in it', type: '' } }).code
		).toBeUndefined();
		expect(classifyHttp('openai', 400, { error: { code: 'x'.repeat(65) } }).code).toBeUndefined();
	});

	test('code is undefined for non-JSON or empty bodies', () => {
		expect(classifyHttp('openai', 401, 'Unauthorized').code).toBeUndefined();
		expect(classifyHttp('openai', 500, {}).code).toBeUndefined();
		expect(classifyHttp('openai', 502, undefined).code).toBeUndefined();
		expect(classifyHttp('gemini', 503, null).code).toBeUndefined();
	});

	test('the API_KEY_INVALID rule is Gemini-only', () => {
		expect(
			classifyHttp('openai', 400, { error: { details: [{ reason: 'API_KEY_INVALID' }] } }).kind
		).toBe('interrupted');
	});
});

describe('isAbort', () => {
	test('AbortError by name', () => expect(isAbort({ name: 'AbortError' })).toBe(true));
	test('aborted signal', () => expect(isAbort(new Error('x'), { aborted: true })).toBe(true));
	test('fetch TypeError is not an abort', () =>
		expect(isAbort(new TypeError('Failed to fetch'))).toBe(false));
	test('non-object errors', () => {
		expect(isAbort(null)).toBe(false);
		expect(isAbort('AbortError')).toBe(false);
		expect(isAbort(new Error('x'), { aborted: false })).toBe(false);
	});
});

describe('isFetchTypeError', () => {
	test('plain TypeError', () =>
		expect(isFetchTypeError(new TypeError('Failed to fetch'))).toBe(true));
	test('TypeError after abort is not a fetch error', () =>
		expect(isFetchTypeError(new TypeError('x'), { aborted: true })).toBe(false));
	test('AbortError is not a fetch error', () =>
		expect(isFetchTypeError({ name: 'AbortError' })).toBe(false));
	test('generic Error is not a fetch error', () =>
		expect(isFetchTypeError(new Error('x'))).toBe(false));
});

describe('toLlmError', () => {
	test('passes an existing LlmError through', () => {
		const e = new LlmError('quota', { status: 429 });
		expect(toLlmError(e)).toBe(e);
	});
	test('abort -> aborted', () => expect(toLlmError({ name: 'AbortError' }).kind).toBe('aborted'));
	test('abort via signal -> aborted', () =>
		expect(toLlmError(new TypeError('x'), { aborted: true }).kind).toBe('aborted'));
	test('fetch TypeError -> network', () =>
		expect(toLlmError(new TypeError('Failed to fetch')).kind).toBe('network'));
	test('other -> interrupted, never echoing the original message', () => {
		const e = toLlmError(new Error('boom sk-secret'));
		expect(e.kind).toBe('interrupted');
		expect(e.message).toBe('interrupted');
	});
});
