import Dexie, { type Table } from 'dexie';
import type { ProviderId } from '@tran/core';
import type { Box } from './crypto';

// A database SEPARATE from the main 'tran' data DB. Backup export reads only the registered tables
// of 'tran', so it structurally cannot read keys from here.
// Never call Dexie.delete() on this DB: deleting a database another tab holds open raises blocked /
// versionchange events. Forget-all clears the tables inside one rw transaction instead.

/** `value` = plaintext (remember mode, no lock); `box` = sealed (passphrase lock, 03-07). */
export interface KeyRow {
	provider: ProviderId;
	value?: string;
	box?: Box;
}

/** 'mode' row now; the 'vault' (passphrase) row is added by 03-07. */
export interface MetaRow {
	id: string;
	[k: string]: unknown;
}

export const SECRETS_DB_NAME = 'tran-secrets';

export class SecretsDb extends Dexie {
	keys!: Table<KeyRow, ProviderId>;
	meta!: Table<MetaRow, string>;

	constructor(options?: { indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange }) {
		super('tran-secrets', options);
		this.version(1).stores({ keys: 'provider', meta: 'id' });
	}
}

export const createSecretsDb = (options?: ConstructorParameters<typeof SecretsDb>[0]) =>
	new SecretsDb(options);
