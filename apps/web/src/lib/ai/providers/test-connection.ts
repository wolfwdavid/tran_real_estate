/**
 * Provider-agnostic Test connection and fetch-failure disambiguation
 * (05-RESEARCH Pattern 2 and Pattern 3).
 *
 * Models-list CORS is not generation CORS. The keyless canary proves the generation
 * endpoint is browser-reachable without spending tokens or sending the key.
 *
 * A generation fetch TypeError is ambiguous (OpenAI answers a bad key with a 401 that has
 * no CORS header). The keyed, CORS-readable probe resolves it: an HTTP status maps to
 * auth/quota, a 200 means the generation endpoint itself is blocked (cors-blocked), and an
 * unreachable probe is network only when the browser reports being offline.
 *
 * Neither function ever puts key material into its result.
 */
import { classifyHttp, type LlmErrorKind } from '@tran/core/ai';
import type {
	FetchDeps,
	ProbeResponse,
	ProviderProbe,
	TestConnectionResult,
	TestOutcome
} from '../ports.js';
import { resolveFetch } from './http.js';

export async function runTestConnection(
	probe: ProviderProbe,
	key: string,
	model: string,
	deps: FetchDeps = {}
): Promise<TestConnectionResult> {
	const f = resolveFetch(deps);

	let check: ProbeResponse;
	try {
		check = await probe.keyCheck(key, f);
	} catch {
		return { outcome: 'network' };
	}
	if (check.status !== 200) {
		const kind = classifyHttp(probe.id, check.status, check.body).kind;
		const outcome: TestOutcome = kind === 'auth' ? 'auth' : kind === 'quota' ? 'quota' : 'network';
		return { outcome };
	}

	let modelListed: boolean | undefined;
	try {
		modelListed = await probe.modelListed(key, model, f, check);
	} catch {
		modelListed = undefined;
	}

	try {
		await probe.canary(f);
	} catch {
		return { outcome: 'cors-blocked' };
	}
	return { outcome: 'ok', modelListed };
}

export async function disambiguateFetchFailure(
	probe: ProviderProbe,
	key: string,
	deps: FetchDeps = {}
): Promise<LlmErrorKind> {
	const online = deps.isOnline ?? (() => globalThis.navigator?.onLine !== false);
	try {
		const check = await probe.keyCheck(key, resolveFetch(deps));
		return check.status === 200
			? 'cors-blocked'
			: classifyHttp(probe.id, check.status, check.body).kind;
	} catch {
		return online() ? 'cors-blocked' : 'network';
	}
}
