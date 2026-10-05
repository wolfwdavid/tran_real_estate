// The zero-cost key test. A malformed key never leaves the browser; a well-formed one is sent
// once to PROBE_REQUEST (ZIP 00000), which RentCast answers without billing. The ledger entry
// for the rare valid-billed (200) edge is recorded by the gateway, not here.
import {
	classifyProbe,
	PROBE_REQUEST,
	validateKeyFormat,
	type KeyTestOutcome
} from '@tran/core/request';
import { createRentCastClient } from './client';

export type ProbeResult =
	| { outcome: KeyTestOutcome; status: number }
	| {
			outcome: 'bad-format';
			formatError: 'empty' | 'whitespace' | 'charset' | 'length';
			status: null;
	  };

export async function testRentCastKey(
	rawKey: string,
	deps: { fetch: typeof fetch; origin?: string }
): Promise<ProbeResult> {
	const format = validateKeyFormat(rawKey);
	if (!format.ok) return { outcome: 'bad-format', formatError: format.error, status: null };

	const key = format.key;
	const client = createRentCastClient({
		fetch: deps.fetch,
		getKey: () => key,
		origin: deps.origin
	});
	const { status } = await client.get(PROBE_REQUEST);
	return { outcome: classifyProbe(status), status };
}
