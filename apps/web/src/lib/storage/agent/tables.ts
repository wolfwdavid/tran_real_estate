// Agent CRM table names, Dexie stores and typed accessors (Phase 8). Dependency-free at runtime
// (type imports only), like the renter and investor tables modules, so $lib/storage/db.ts can
// import AGENT_STORES without an import cycle.
//
// Index notes (08-RESEARCH Pattern 1):
// - No boolean indexes: IndexedDB cannot index booleans, so `sample` is filtered in memory.
// - Task `dueDate` is a LOCAL calendar date string (YYYY-MM-DD) and `status` is a string
//   ('open' | 'done'), so the compound `[status+dueDate]` index answers "open tasks due by X".
// - emailNorm / phoneNorm are OMITTED (not empty) when a value cannot be normalized, so rows
//   without a usable key are simply absent from those indexes and never match as duplicates.
//
// Every row is a Phase 3 Syncable record (uuid id, ownerId 'local', ISO timestamps, deletedAt
// OMITTED on live rows), because the backup envelope validates every exported row that way.
import type { Table } from 'dexie';
import type { Activity, AgentProfile, Contact, Task } from '@tran/core/agent/types';
import type { TranDb } from '$lib/storage/db';

export const CONTACTS_TABLE = 'contacts';
export const TASKS_TABLE = 'tasks';
export const ACTIVITIES_TABLE = 'activities';
export const AGENT_PROFILE_TABLE = 'agentProfile';

/** schemaVersion stamped on every agent Syncable record. */
export const AGENT_RECORD_SCHEMA_VERSION = 1;

/**
 * Stored id of the singleton profile row. The domain record's id is the literal 'profile'
 * (@tran/core/agent/types), but the Phase 3 backup envelope requires a uuid id on every row, so
 * the row is keyed by this fixed uuid and profile-repo maps between the two. A fixed value keeps
 * the profile the same row in every browser, so a backup merge updates it instead of duplicating.
 */
export const PROFILE_ROW_ID = '00000000-0000-4000-8000-000000a6e170';

/** Dexie stores for TranDb's version 6 block. */
export const AGENT_STORES = Object.freeze({
	[CONTACTS_TABLE]:
		'id, stage, emailNorm, phoneNorm, createdAt, updatedAt, lastContactedAt, deletedAt',
	[TASKS_TABLE]: 'id, contactId, [status+dueDate], updatedAt, deletedAt',
	[ACTIVITIES_TABLE]: 'id, contactId, [contactId+at], at',
	[AGENT_PROFILE_TABLE]: 'id'
});

/** The stored profile row: the domain profile with the fixed uuid row id. */
export type AgentProfileRow = Omit<AgentProfile, 'id'> & {
	id: typeof PROFILE_ROW_ID;
};

export const contactsTable = (db: TranDb): Table<Contact, string> => db.contacts;
export const tasksTable = (db: TranDb): Table<Task, string> => db.tasks;
export const activitiesTable = (db: TranDb): Table<Activity, string> => db.activities;
export const agentProfileTable = (db: TranDb): Table<AgentProfileRow, string> => db.agentProfile;
