// The data-source preference ('rentcast' | 'sample'), persisted as one Syncable dataPrefs row with a
// fixed id so backups merge it by id + updatedAt across devices. Default 'rentcast': with a readable
// key the app runs live unless the user forces sample mode (resolveMode in mode.ts decides).
import { newSyncable } from '@tran/core';
import type { DataDb } from './platform';
import {
	DATA_PREF_IDS,
	DATA_RECORD_SCHEMA_VERSION,
	type DataPrefRow,
	type DataSourcePref
} from './tables';

export interface PrefsRepo {
	readSource(): Promise<DataSourcePref>;
	/** TypeError unless `p` is 'rentcast' or 'sample'. */
	writeSource(p: DataSourcePref): Promise<void>;
}

export const DEFAULT_DATA_SOURCE: DataSourcePref = 'rentcast';

const isDataSourcePref = (p: unknown): p is DataSourcePref => p === 'rentcast' || p === 'sample';

export function createPrefsRepo(db: DataDb, clock: () => number): PrefsRepo {
	return {
		async readSource() {
			const row = await db.dataPrefs.get('dataSource');
			return row?.key === 'dataSource' && isDataSourcePref(row.value)
				? row.value
				: DEFAULT_DATA_SOURCE;
		},

		async writeSource(p) {
			if (!isDataSourcePref(p)) throw new TypeError("data source must be 'rentcast' or 'sample'");
			const now = new Date(clock());
			await db.transaction('rw', db.dataPrefs, async () => {
				const existing = await db.dataPrefs.get('dataSource');
				const base =
					existing ??
					newSyncable({
						id: DATA_PREF_IDS.dataSource,
						now,
						schemaVersion: DATA_RECORD_SCHEMA_VERSION
					});
				const row: DataPrefRow = {
					...base,
					key: 'dataSource',
					value: p,
					updatedAt: now.toISOString()
				};
				await db.dataPrefs.put(row);
			});
		}
	};
}
