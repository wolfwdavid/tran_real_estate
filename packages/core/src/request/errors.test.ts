import { describe, expect, test } from 'vitest';

import { canonicalKey } from './canonical.js';
import {
	backoffMs,
	classifyResponse,
	GatewayError,
	isGatewayError,
	type GatewayErrorDetail,
	type GatewayErrorKind
} from './errors.js';
import { classifyProbe, PROBE_REQUEST, validateKeyFormat, type KeyTestOutcome } from './probe.js';

describe('classifyResponse', () => {
	test('200 is not an error', () => {
		expect(classifyResponse(200, [])).toBeNull();
	});

	test.each<[number, unknown, GatewayErrorKind, GatewayErrorDetail | undefined]>([
		[400, { error: 'resource/bad-request' }, 'NoResults', 'bad-request'],
		[400, undefined, 'NoResults', 'bad-request'],
		[401, { error: 'auth/api-key-invalid' }, 'InvalidKey', undefined],
		[401, undefined, 'InvalidKey', undefined],
		[403, { error: 'billing/subscription-inactive' }, 'RestrictedKey', 'billing'],
		[403, { error: 'auth/endpoint-restricted' }, 'RestrictedKey', 'restriction'],
		[403, undefined, 'RestrictedKey', 'restriction'],
		[403, 'billing/as-a-string-body', 'RestrictedKey', 'restriction'],
		[404, undefined, 'NoResults', undefined],
		[404, { error: 'resource/not-found' }, 'NoResults', undefined],
		[404, { error: 'sample/outside-coverage' }, 'NoResults', 'outside-sample-coverage'],
		[405, undefined, 'NetworkError', 'server'],
		[429, { error: 'auth/rate-limit-exceeded' }, 'RateLimited', undefined],
		[500, undefined, 'NetworkError', 'server'],
		[502, undefined, 'NetworkError', 'server'],
		[504, undefined, 'NetworkError', 'server'],
		[0, undefined, 'NetworkError', undefined]
	])('%i %j -> %s/%s', (status, body, kind, detail) => {
		const result = classifyResponse(status, body);
		expect(result).toEqual(detail === undefined ? { kind } : { kind, detail });
	});
});

describe('backoffMs', () => {
	test.each([
		[0, 2000],
		[1, 4000],
		[2, 8000],
		[3, 16000],
		[4, 30000],
		[10, 30000]
	])('attempt %i -> %i ms', (attempt, ms) => {
		expect(backoffMs(attempt)).toBe(ms);
	});
});

describe('GatewayError', () => {
	test('message is the kind and fields are carried', () => {
		const e = new GatewayError({ kind: 'BudgetCapReached', used: 40, cap: 40 });
		expect(e).toBeInstanceOf(Error);
		expect(e.name).toBe('GatewayError');
		expect(e.message).toBe('BudgetCapReached');
		expect(e.kind).toBe('BudgetCapReached');
		expect(e.used).toBe(40);
		expect(e.cap).toBe(40);
		expect(e.detail).toBeUndefined();
	});

	test('serialization holds only the listed fields, never a key or a body', () => {
		const info = {
			kind: 'SchemaMismatch',
			issues: ['0.price'],
			requestKey: 'rental-listings?zipCode=74201',
			apiKey: 'rc_live_secret_key_value_1234',
			body: { formattedAddress: '1 Real St' }
		} as unknown as ConstructorParameters<typeof GatewayError>[0];
		const json = JSON.stringify(new GatewayError(info));
		expect(json).not.toContain('rc_live_secret_key_value_1234');
		expect(json).not.toContain('1 Real St');
		expect(JSON.parse(json)).toMatchObject({
			kind: 'SchemaMismatch',
			issues: ['0.price'],
			requestKey: 'rental-listings?zipCode=74201'
		});
	});

	test('isGatewayError discriminates', () => {
		expect(isGatewayError(new GatewayError({ kind: 'NoResults' }))).toBe(true);
		expect(isGatewayError(new Error('x'))).toBe(false);
		expect(isGatewayError({ kind: 'NoResults' })).toBe(false);
		expect(isGatewayError(null)).toBe(false);
	});
});

describe('zero-cost key probe', () => {
	test('PROBE_REQUEST is the unassigned-ZIP markets call', () => {
		expect(PROBE_REQUEST).toEqual({
			endpoint: 'markets',
			params: { zipCode: '00000', dataType: 'Rental', historyRange: 1 }
		});
		expect(canonicalKey(PROBE_REQUEST)).toBe(
			'markets?dataType=Rental&historyRange=1&zipCode=00000'
		);
	});

	test.each<[number, KeyTestOutcome]>([
		[400, 'valid'],
		[404, 'valid'],
		[200, 'valid-billed'],
		[401, 'invalid'],
		[403, 'restricted'],
		[429, 'rate-limited'],
		[0, 'unverified'],
		[405, 'unverified'],
		[500, 'unverified'],
		[504, 'unverified']
	])('classifyProbe(%i) -> %s', (status, outcome) => {
		expect(classifyProbe(status)).toBe(outcome);
	});
});

describe('validateKeyFormat', () => {
	test.each<[string, string]>([
		['', 'empty'],
		['   ', 'empty'],
		['abc def', 'whitespace'],
		['abcd\tefghijklmnopq', 'whitespace'],
		['abcé'.repeat(5), 'charset'],
		['k'.repeat(15), 'length'],
		['k'.repeat(129), 'length']
	])('%j -> %s', (input, error) => {
		expect(validateKeyFormat(input)).toEqual({ ok: false, error });
	});

	test('trims surrounding whitespace and accepts 16..128 printable ASCII', () => {
		expect(validateKeyFormat('  ' + 'k'.repeat(32) + '\n')).toEqual({
			ok: true,
			key: 'k'.repeat(32)
		});
		expect(validateKeyFormat('k'.repeat(16))).toEqual({ ok: true, key: 'k'.repeat(16) });
		expect(validateKeyFormat('k'.repeat(128))).toEqual({ ok: true, key: 'k'.repeat(128) });
		expect(validateKeyFormat('A1b2-C3d4_E5f6.G7h8')).toMatchObject({ ok: true });
	});
});
