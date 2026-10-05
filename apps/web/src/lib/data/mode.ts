// Which data source is active (DATA-01). Pure: no I/O, no runes, no globals.
//
// No readable RentCast key always means sample mode, whatever the preference says: a missing key
// ('no-key') or a passphrase-locked one ('locked'). With a readable key the user's preference
// decides: 'sample' is an explicit choice ('chosen'), 'rentcast' is live mode ('live').
// The reason drives the DataStatusBar variant copy.
import type { RentCastKeyState } from './platform';
import type { DataSourcePref } from './tables';

export type DataMode = 'sample' | 'rentcast';

export type ModeReason = 'no-key' | 'locked' | 'chosen' | 'live';

export interface ResolvedMode {
	source: DataMode;
	reason: ModeReason;
}

export function resolveMode(input: {
	keyState: RentCastKeyState;
	preference: DataSourcePref;
}): ResolvedMode {
	if (input.keyState === 'locked') return { source: 'sample', reason: 'locked' };
	if (input.keyState !== 'available') return { source: 'sample', reason: 'no-key' };
	if (input.preference === 'sample') return { source: 'sample', reason: 'chosen' };
	return { source: 'rentcast', reason: 'live' };
}
