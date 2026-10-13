// First-run guide state. localStorage only: the landing page may not import Dexie or $lib/storage
// (RESEARCH Pitfall 9). Nothing here touches storage at import time, because prerendering has no
// localStorage; components read it in onMount. The value holds no personal data.

export const ONBOARDING_KEY = 'tran.onboarding.v1';

export type OnboardingPortal = 'renter' | 'investor' | 'agent';
export type OnboardingStatus = 'new' | 'touring' | 'done' | 'hidden';
export type OnboardingStep = 0 | 1 | 2 | 3;

export interface OnboardingState {
	status: OnboardingStatus;
	portal?: OnboardingPortal;
	step?: OnboardingStep;
	lastPortal?: OnboardingPortal;
}

type KV = Pick<Storage, 'getItem' | 'setItem'>;

const STATUSES: readonly string[] = ['new', 'touring', 'done', 'hidden'];
const PORTALS: readonly string[] = ['renter', 'investor', 'agent'];
const STEPS: readonly unknown[] = [0, 1, 2, 3];

const isPortal = (v: unknown): v is OnboardingPortal =>
	typeof v === 'string' && PORTALS.includes(v);

/** Strict whitelist parse. Anything unreadable, or a bad status/step, falls back to `new`. */
export function parseOnboarding(raw: string | null): OnboardingState {
	const fallback: OnboardingState = { status: 'new' };
	if (raw === null) return fallback;
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return fallback;
	}
	if (!data || typeof data !== 'object' || Array.isArray(data)) return fallback;
	const o = data as Record<string, unknown>;
	if (typeof o.status !== 'string' || !STATUSES.includes(o.status)) return fallback;
	if (o.step !== undefined && !STEPS.includes(o.step)) return fallback;

	const state: OnboardingState = { status: o.status as OnboardingStatus };
	if (isPortal(o.portal)) state.portal = o.portal;
	if (o.step !== undefined) state.step = o.step as OnboardingStep;
	if (isPortal(o.lastPortal)) state.lastPortal = o.lastPortal;
	return state;
}

const defaultStorage = (): KV | undefined => {
	try {
		return globalThis.localStorage ?? undefined;
	} catch {
		return undefined;
	}
};

/** Reads the stored state; blocked or missing storage reads as a first visit. */
export function readOnboarding(storage: KV | undefined = defaultStorage()): OnboardingState {
	try {
		return parseOnboarding(storage?.getItem(ONBOARDING_KEY) ?? null);
	} catch {
		return { status: 'new' };
	}
}

/** Persists the state. Returns false when storage is missing or refuses the write. */
export function writeOnboarding(
	state: OnboardingState,
	storage: KV | undefined = defaultStorage()
): boolean {
	try {
		if (!storage) return false;
		storage.setItem(ONBOARDING_KEY, JSON.stringify(state));
		return true;
	} catch {
		return false;
	}
}
