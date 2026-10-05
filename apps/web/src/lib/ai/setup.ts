// Wires the AI layer to the Phase 3 platform: live adapters read their key from the Phase 3 vault
// (vault.getKey(provider), undefined when absent or locked), the panel's live-vs-sample decision,
// and the four AI "Test key" testers registered through the Phase 3 registerKeyTester hook.
//
// Load this module with a dynamic import() from (app) routes only (UI-SPEC hydration rule), so
// marketing pages never pull in the adapters. Nothing here touches the vault at module scope.
//
// Key rule: a key passes through only as the argument the Phase 3 card hands a tester, or as the
// value an adapter reads from the vault. It never lands in a result, a message or a log.
import type { ProviderId } from '@tran/core';
import type { LiveProviderId } from '@tran/core/ai';
import type { KeyState, KeyTestResult, KeyTestStatus } from '$lib/storage/secrets';
import type { registerKeyTester } from '$lib/storage/secrets/testers';
import { PROVIDER_LABELS, PROVIDER_ORDER, hostFor } from './models';
import type {
	AdapterDeps,
	FetchDeps,
	LlmProvider,
	ProviderProbe,
	TestConnectionResult,
	TestOutcome
} from './ports';
import { anthropicProbe, anthropicProvider } from './providers/anthropic';
import { fixtureProvider, type FixtureDeps } from './providers/fixture';
import { geminiProbe, geminiProvider } from './providers/gemini';
import { openaiProbe, openaiProvider } from './providers/openai';
import { openrouterProbe, openrouterProvider } from './providers/openrouter';
import { runTestConnection } from './providers/test-connection';
import { testResultCopy } from './ui/ai-copy';

export const PROBES: Record<LiveProviderId, ProviderProbe> = {
	anthropic: anthropicProbe,
	openai: openaiProbe,
	gemini: geminiProbe,
	openrouter: openrouterProbe
};

/** Phase 3 KeyState collapsed for the AI panel: a session or remembered key is 'saved'. */
export type AiKeyState = 'saved' | 'none' | 'locked';

export function toAiKeyState(s: KeyState): AiKeyState {
	switch (s) {
		case 'session':
		case 'remembered':
			return 'saved';
		case 'locked':
			return 'locked';
		default:
			return 'none';
	}
}

/** The slice of the Phase 3 Vault the AI layer reads (tests pass a fake). */
export interface AiVaultLike {
	getStatus(): { providers: Partial<Record<ProviderId, { state: KeyState }>> };
}

/** Synchronous key-state reader over a vault's current status (no key material involved). */
export function keyStateFrom(vault: AiVaultLike): (id: LiveProviderId) => AiKeyState {
	return (id) => toAiKeyState(vault.getStatus().providers[id]?.state ?? 'none');
}

export function createLiveProvider(id: LiveProviderId, deps: AdapterDeps): LlmProvider {
	switch (id) {
		case 'anthropic':
			return anthropicProvider(deps);
		case 'openai':
			return openaiProvider(deps);
		case 'gemini':
			return geminiProvider(deps);
		case 'openrouter':
			return openrouterProvider(deps);
	}
}

export type Selection =
	| { kind: 'live'; id: LiveProviderId }
	| { kind: 'sample'; reason: 'no-key' | 'toggle'; id: LiveProviderId | null }
	| { kind: 'locked'; id: LiveProviderId };

/**
 * The first provider in PROVIDER_ORDER with a saved key (UI-SPEC picker default), else the first
 * with a locked key, else null. A locked key is still a key: falling back to it surfaces "Your keys
 * are locked" instead of the false "No AI key yet" sample notice (05-16).
 */
export function defaultPreferred(
	keyState: (id: LiveProviderId) => AiKeyState
): LiveProviderId | null {
	return (
		PROVIDER_ORDER.find((id) => keyState(id) === 'saved') ??
		PROVIDER_ORDER.find((id) => keyState(id) === 'locked') ??
		null
	);
}

/**
 * Live vs sample, with the reason. The sample toggle wins over everything; a keyless provider can
 * be chosen (its drafts use sample output); 'locked' only when the chosen provider is locked.
 */
export function selectProvider(o: {
	preferred: LiveProviderId | null;
	sample: boolean;
	keyState: (id: LiveProviderId) => AiKeyState;
}): Selection {
	const id = o.preferred ?? defaultPreferred(o.keyState);
	if (o.sample) return { kind: 'sample', reason: 'toggle', id };
	if (id === null) return { kind: 'sample', reason: 'no-key', id: null };
	const state = o.keyState(id);
	if (state === 'saved') return { kind: 'live', id };
	if (state === 'locked') return { kind: 'locked', id };
	return { kind: 'sample', reason: 'no-key', id };
}

/**
 * The provider a selection runs on: the live adapter (its key read from the vault at stream time)
 * for 'live', the keyless fixture provider otherwise. A locked selection never reaches the
 * network: the panel shows the unlock prompt and any draft is sample output.
 */
export function resolveProvider(
	sel: Selection,
	deps: FetchDeps & {
		getKey: (id: LiveProviderId) => Promise<string | null | undefined>;
		fixture?: FixtureDeps;
	}
): LlmProvider {
	if (sel.kind !== 'live') return fixtureProvider(deps.fixture);
	const id = sel.id;
	return createLiveProvider(id, {
		fetch: deps.fetch,
		isOnline: deps.isOnline,
		getKey: () => deps.getKey(id)
	});
}

/** The Phase 3 result plus the raw AI outcome (an additive, optional field). */
export type AiKeyTestResult = KeyTestResult & { ai?: TestConnectionResult };

const OUTCOME_STATUS: Readonly<Record<TestOutcome, KeyTestStatus>> = Object.freeze({
	ok: 'accepted',
	auth: 'rejected',
	quota: 'rate-limited',
	'cors-blocked': 'failed',
	network: 'failed'
});

export function toKeyTestResult(r: TestConnectionResult, copy: { line: string }): AiKeyTestResult {
	return { status: OUTCOME_STATUS[r.outcome], message: copy.line, ai: r };
}

/**
 * Registers Test key for the four AI providers through the Phase 3 hook (the card shows the button
 * only while a tester is registered). Returns the four unregister functions; call them when
 * Settings unmounts. The tester tests the key the card hands it, against deps.model(provider).
 */
export function registerAiTestKeys(
	register: typeof registerKeyTester,
	deps: { model: (p: LiveProviderId) => string; fetch?: typeof fetch }
): Array<() => void> {
	return PROVIDER_ORDER.map((id) =>
		register(id, async (key) => {
			const model = deps.model(id);
			const r = await runTestConnection(PROBES[id], key, model, { fetch: deps.fetch });
			const copy = testResultCopy(r, {
				provider: id,
				providerLabel: PROVIDER_LABELS[id],
				model,
				host: hostFor(id)
			});
			return toKeyTestResult(r, copy);
		})
	);
}
