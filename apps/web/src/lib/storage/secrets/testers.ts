import { SvelteMap } from 'svelte/reactivity';
import type { ProviderId } from '@tran/core';

// Pluggable "Test key" checks. Phases 4/5 register one per provider (RentCast, LLMs); the vault
// never calls the network itself. Phase 3 registers NO testers, so the Test key button stays
// hidden in production until a phase adds one.

export const KEY_TEST_STATUSES = ['accepted', 'rejected', 'rate-limited', 'failed'] as const;
export type KeyTestStatus = (typeof KEY_TEST_STATUSES)[number];

/** `message` overrides the default UI line (e.g. Phase 4 RentCast strings). It never echoes the key. */
export interface KeyTestResult {
	status: KeyTestStatus;
	message?: string;
}

export type KeyTester = (key: string, signal: AbortSignal) => Promise<KeyTestResult>;

// Reactive: Settings registers the AI testers asynchronously (05-15), so a key card that rendered
// before registration must update when its tester arrives. Outside an effect it is a plain Map.
const testers = new SvelteMap<ProviderId, KeyTester>();

/** Registers (or replaces: last wins) the tester for a provider. Returns an unregister function. */
export function registerKeyTester(p: ProviderId, fn: KeyTester): () => void {
	testers.set(p, fn);
	return () => {
		if (testers.get(p) === fn) testers.delete(p);
	};
}

export function getKeyTester(p: ProviderId): KeyTester | undefined {
	return testers.get(p);
}

export function hasKeyTester(p: ProviderId): boolean {
	return testers.has(p);
}

/** Test helper: clears every registration. */
export function _resetKeyTesters(): void {
	testers.clear();
}
