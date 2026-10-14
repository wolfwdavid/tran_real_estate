// Append-only RentCast call ledger plus the cap preference (DATA-03).
//
// reserve() reads the period's usage and the cap and appends the pending row inside ONE Dexie
// read-write transaction over ledger + dataPrefs. IndexedDB serializes overlapping rw transactions
// across connections, so two tabs at 39/40 cannot both take call #40
// (ledger.concurrency.test.ts proves this and fails if the read moves out of the transaction).
//
// Rows store the HTTP status (or 'pending'), never a billed flag: billing is derived at read time
// by @tran/core/budget isBilled via summarize(). Rows hold the canonical request key, never the API key.
import {
	CAP_MAX,
	CAP_MIN,
	DEFAULT_CAP,
	periodKey,
	resetsAt,
	summarize,
	canSpend
} from '@tran/core/budget';
import type { UsageSummary } from '@tran/core/budget';
import { GatewayError, type EndpointId } from '@tran/core/request';
import { newSyncable } from '@tran/core';
import type { DataDb } from './platform';
import { consumeGrant, type OverCapGrant } from './grants';
import {
	DATA_PREF_IDS,
	DATA_RECORD_SCHEMA_VERSION,
	type DataPrefRow,
	type LedgerIntent,
	type LedgerRow
} from './tables';

export interface SpendRequest {
	endpoint: EndpointId;
	key: string;
	intent: LedgerIntent;
}

export interface UsageSnapshot extends UsageSummary {
	cap: number;
	periodKey: string;
	resetsAt: number;
}

export interface LedgerRepo {
	/** Appends a pending row and returns its id; throws GatewayError 'BudgetCapReached' at the cap. */
	reserve(req: SpendRequest, grant?: OverCapGrant): Promise<string>;
	settle(id: string, status: number): Promise<void>;
	/** Appends an already-settled row without a cap check (key tests). */
	record(req: SpendRequest, status: number): Promise<string>;
	usage(): Promise<UsageSnapshot>;
	readCap(): Promise<number>;
	/** RangeError unless `cap` is a whole number in CAP_MIN..CAP_MAX. */
	writeCap(cap: number): Promise<void>;
}

/**
 * True once a cap has been saved at least once (the `rentcastCap` row exists). No row means the
 * default cap is in force. /setup/rentcast/ shows its step 3 "Done" badge from this.
 */
export async function hasSavedCap(db: DataDb): Promise<boolean> {
	const row = await db.dataPrefs.get('rentcastCap');
	return row?.key === 'rentcastCap';
}

export function createLedgerRepo(db: DataDb, clock: () => number): LedgerRepo {
	const readCapRow = async (): Promise<number> => {
		const row = await db.dataPrefs.get('rentcastCap');
		return row?.key === 'rentcastCap' ? row.value : DEFAULT_CAP;
	};

	const periodRows = (period: string) => db.ledger.where('periodKey').equals(period).toArray();

	const newRow = (
		now: number,
		req: SpendRequest,
		status: LedgerRow['status'],
		overCap: boolean
	): LedgerRow => ({
		...newSyncable({
			id: crypto.randomUUID(),
			now: new Date(now),
			schemaVersion: DATA_RECORD_SCHEMA_VERSION
		}),
		periodKey: periodKey(now),
		at: now,
		endpoint: req.endpoint,
		key: req.key,
		intent: req.intent,
		status,
		overCap,
		settledAt: status === 'pending' ? null : now
	});

	return {
		reserve: (req, grant) =>
			db.transaction('rw', db.ledger, db.dataPrefs, async () => {
				const now = clock();
				const period = periodKey(now);
				const used = summarize(await periodRows(period), now).countedTowardCap;
				const cap = await readCapRow();
				const overCap = !canSpend(used, cap);
				if (overCap && !consumeGrant(grant, req.key)) {
					throw new GatewayError({
						kind: 'BudgetCapReached',
						used,
						cap,
						resetsAt: resetsAt(now),
						requestKey: req.key
					});
				}
				const row = newRow(now, req, 'pending', overCap);
				await db.ledger.add(row);
				return row.id;
			}),

		async settle(id, status) {
			const now = clock();
			await db.ledger.update(id, {
				status,
				settledAt: now,
				updatedAt: new Date(now).toISOString()
			});
		},

		async record(req, status) {
			const row = newRow(clock(), req, status, false);
			await db.ledger.add(row);
			return row.id;
		},

		usage: () =>
			db.transaction('r', db.ledger, db.dataPrefs, async () => {
				const now = clock();
				const period = periodKey(now);
				const summary = summarize(await periodRows(period), now);
				return { ...summary, cap: await readCapRow(), periodKey: period, resetsAt: resetsAt(now) };
			}),

		readCap: readCapRow,

		async writeCap(cap) {
			if (!Number.isInteger(cap) || cap < CAP_MIN || cap > CAP_MAX) {
				throw new RangeError(`cap must be a whole number from ${CAP_MIN} to ${CAP_MAX}`);
			}
			const now = new Date(clock());
			await db.transaction('rw', db.dataPrefs, async () => {
				const existing = await db.dataPrefs.get('rentcastCap');
				const base =
					existing ??
					newSyncable({
						id: DATA_PREF_IDS.rentcastCap,
						now,
						schemaVersion: DATA_RECORD_SCHEMA_VERSION
					});
				const row: DataPrefRow = {
					...base,
					key: 'rentcastCap',
					value: cap,
					updatedAt: now.toISOString()
				};
				await db.dataPrefs.put(row);
			});
		}
	};
}
