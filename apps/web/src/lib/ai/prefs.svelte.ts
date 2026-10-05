// AI preferences, per device: chosen provider, the "sample output" toggle and per-provider model
// overrides. Stored with runed PersistedState in localStorage (UI-SPEC: "persists via the
// Phase 3 settings store (PersistedState)"), so reads are synchronous and reactive and other tabs
// follow along through the storage event.
//
// These are tiny UI prefs: no key material, and NOT part of backups (localStorage is outside the
// Dexie backup by construction). The Gemini client-data acknowledgement is not a pref: it lives in
// sessionStorage via gemini-gate.ts.
//
// Stored values are untrusted on read (another script or an old build may have written them):
// unknown providers, non-boolean toggles and invalid model ids fall back to the defaults.
import { PersistedState } from 'runed';
import type { LiveProviderId } from '@tran/core/ai';
import { PROVIDER_ORDER, defaultModel, validateModelId } from './models';

export const AI_PREF_KEYS = {
	provider: 'tran.ai.provider',
	sample: 'tran.ai.sample',
	models: 'tran.ai.models'
} as const;

export type AiModelOverrides = Partial<Record<LiveProviderId, string>>;

export interface AiPrefs {
	/** null until the user picks one (the picker then defaults to the first saved key). */
	provider: LiveProviderId | null;
	/** Force sample output even with a key. Default false. */
	sample: boolean;
	readonly models: AiModelOverrides;
	/** The override for `id`, else the registry default. */
	effectiveModel(id: LiveProviderId): string;
	/** Sets a trimmed override; null resets to the default. Throws 'empty' | 'spaces'. */
	setModel(id: LiveProviderId, model: string | null): void;
}

const isProvider = (v: unknown): v is LiveProviderId =>
	typeof v === 'string' && (PROVIDER_ORDER as readonly string[]).includes(v);

function cleanModels(v: unknown): AiModelOverrides {
	const out: AiModelOverrides = {};
	if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
	for (const id of PROVIDER_ORDER) {
		if (!Object.hasOwn(v, id)) continue;
		const m = (v as Record<string, unknown>)[id];
		if (typeof m === 'string' && validateModelId(m) === null) out[id] = m.trim();
	}
	return out;
}

type StorageWindow = { localStorage: Storage } | undefined;

/** The browser window when localStorage is usable; undefined in prerender or when blocked. */
function storageWindow(): StorageWindow {
	if (typeof window === 'undefined') return undefined;
	try {
		window.localStorage.getItem(AI_PREF_KEYS.provider);
		return window;
	} catch {
		return undefined; // Storage blocked: prefs last for this page only.
	}
}

/** Factory for tests (inject a window with a fake localStorage, or none for prerender). */
export function createAiPrefs(
	o: { window?: StorageWindow } = { window: storageWindow() }
): AiPrefs {
	const win = o.window as (Window & typeof globalThis) | undefined;
	// Without a window (prerender, tests) keep values in memory instead of losing writes.
	const opts = { window: win, connected: win !== undefined };
	const provider = new PersistedState<unknown>(AI_PREF_KEYS.provider, null, opts);
	const sample = new PersistedState<unknown>(AI_PREF_KEYS.sample, false, opts);
	const models = new PersistedState<unknown>(AI_PREF_KEYS.models, {}, opts);

	const readModels = () => cleanModels(models.current);

	return {
		get provider() {
			const v = provider.current;
			return isProvider(v) ? v : null;
		},
		set provider(v: LiveProviderId | null) {
			if (v !== null && !isProvider(v)) throw new Error('ai-provider');
			provider.current = v;
		},
		get sample() {
			return sample.current === true;
		},
		set sample(v: boolean) {
			sample.current = v === true;
		},
		get models() {
			return readModels();
		},
		effectiveModel(id) {
			return readModels()[id] ?? defaultModel(id);
		},
		setModel(id, model) {
			if (!isProvider(id)) throw new Error('ai-provider');
			const next = readModels();
			if (model === null) {
				delete next[id];
			} else {
				const problem = validateModelId(model);
				if (problem) throw new Error(problem);
				next[id] = model.trim();
			}
			models.current = next;
		}
	};
}

/** App singleton. Safe to import during prerender (no storage access without a window). */
export const aiPrefs: AiPrefs = createAiPrefs();
