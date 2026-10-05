/**
 * Provider-agnostic Test connection and fetch-failure disambiguation (implemented in the
 * next task; signature stub so http.ts compiles).
 */
import type { LlmErrorKind } from '@tran/core/ai';
import type { FetchDeps, ProviderProbe } from '../ports.js';

export async function disambiguateFetchFailure(
	probe: ProviderProbe,
	key: string,
	deps?: FetchDeps
): Promise<LlmErrorKind> {
	void [probe, key, deps];
	return 'network';
}
