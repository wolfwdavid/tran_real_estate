// The RentCast "Test key (0 calls)" hook for Settings (DATA-05, success criterion 5).
//
// enableRentCastKeyTest(runtime) registers ONE tester with the Phase 3 hook (through platform.ts),
// so the RentCast key card shows its Test key button. Each test runs the runtime's live probe
// (runtime.testKey -> gateway.testKey, RentCast in every mode; 404 = valid at no cost, a 200 is
// recorded as one counted 'key-test' ledger row) and stores the full record in
// `rentCastKeyTest.current` for KeyTestResult.
//
// The result lives in memory only. It persists until the next test, a key change (replace,
// remove, lock, another tab), or the Settings page unmounting (cleanup). A test that finishes
// after a key change is dropped, so a result never shows under a different key.
//
// Phase 3 mapping: the hook's tester must return a RentCastKeyTestOutcome. A failed format check
// (no request made) is reported to Phase 3 as 'invalid' (KeyTestStatus 'rejected'); the card
// renders the precise format message from `rentCastKeyTest.current` instead of Phase 3's line.
import {
	onRentCastKeyChange,
	registerRentCastKeyTest,
	type RentCastKeyTestOutcome
} from './platform';
import type { DataRuntime, KeyTestRecord } from './runtime.svelte';

class RentCastKeyTestState {
	current = $state<KeyTestRecord | null>(null);
}

/** The last RentCast key test result, or null (no test since the last key change). */
export const rentCastKeyTest = new RentCastKeyTestState();

export interface KeyTestDeps {
	register: (test: (key: string) => Promise<RentCastKeyTestOutcome>) => () => void;
	onKeyChange: (listener: () => void) => () => void;
	clock: () => number;
}

const defaultDeps: KeyTestDeps = {
	register: (test) => registerRentCastKeyTest(test),
	onKeyChange: onRentCastKeyChange,
	clock: () => Date.now()
};

/** Registers the RentCast key test. Call from Settings' onMount; returns the cleanup. */
export function enableRentCastKeyTest(
	runtime: DataRuntime,
	deps: Partial<KeyTestDeps> = {}
): () => void {
	const { register, onKeyChange, clock } = { ...defaultDeps, ...deps };
	let generation = 0;

	const offKey = onKeyChange(() => {
		generation++;
		rentCastKeyTest.current = null;
	});

	const unregister = register(async (key) => {
		const gen = generation;
		let record: KeyTestRecord;
		try {
			const result = await runtime.testKey(key);
			record = { ...result, at: clock() };
		} catch {
			record = { outcome: 'unverified', at: clock() };
		}
		if (gen === generation) rentCastKeyTest.current = record;
		return record.outcome === 'bad-format' ? 'invalid' : record.outcome;
	});

	return () => {
		generation++;
		offKey();
		unregister();
		rentCastKeyTest.current = null;
	};
}
