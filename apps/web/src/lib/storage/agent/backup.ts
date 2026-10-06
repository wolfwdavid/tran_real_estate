// Agent CRM backup registration (Phase 8). The four tables are in the registry's built-in list
// ($lib/storage/backup-registry.ts DEFAULT_TABLES), not a runtime registerBackupTable() call, so a
// backup made from Settings before any agent module loads still includes them, and the coverage
// test (every TranDb table registered XOR excluded) enforces it.
//
// Key-free scan carve-outs (08-RESEARCH Pitfall 11, UI-SPEC Planner Note 7). The scan
// (findKeyMaterial) has no entropy or uuid heuristic, but its Gemini shape (`AIza` + 35 chars of
// [0-9A-Za-z_-]) can occur by chance inside a long base64 string: a 300 KB logo hits it roughly
// once in a hundred exports, which would refuse a clean backup. So exactly two PATHS are
// exempt from the scan, never a pattern:
//   - agentProfile `logo.base64`: image bytes, validated as a capped base64 PNG by the schema.
//   - agentProfile `web3formsAccessKey`: the Web3Forms access key is public by design (it ships in
//     every inquiry link) and is a profile field, never a vault secret.
// Every other field of every table is still scanned for provider key shapes and exact vault values.
import * as z from 'zod/mini';
import {
	activitySchema,
	agentProfileSchema,
	contactSchema,
	taskSchema
} from '@tran/core/agent/schemas';
import {
	ACTIVITIES_TABLE,
	AGENT_PROFILE_TABLE,
	CONTACTS_TABLE,
	PROFILE_ROW_ID,
	TASKS_TABLE
} from './tables';

/** Backup validator for the stored profile row (fixed uuid id instead of the domain 'profile'). */
export const agentProfileRowSchema = z.extend(agentProfileSchema, {
	id: z.literal(PROFILE_ROW_ID)
});

/** Paths (dot-separated, relative to a row) the key-free scan skips for the profile table. */
export const AGENT_PROFILE_SCAN_EXEMPT_PATHS: readonly string[] = Object.freeze([
	'logo.base64',
	'web3formsAccessKey'
]);

interface RecordValidator {
	safeParse(value: unknown): { success: boolean };
}

/** Agent tables in the backup, appended to the registry's built-in list. */
export const AGENT_BACKUP_TABLES: readonly {
	readonly name: string;
	readonly label: string;
	readonly schema: RecordValidator;
	readonly scanExemptPaths?: readonly string[];
}[] = Object.freeze([
	Object.freeze({ name: CONTACTS_TABLE, label: 'Contacts', schema: contactSchema }),
	Object.freeze({ name: TASKS_TABLE, label: 'Tasks', schema: taskSchema }),
	Object.freeze({ name: ACTIVITIES_TABLE, label: 'Activity', schema: activitySchema }),
	Object.freeze({
		name: AGENT_PROFILE_TABLE,
		label: 'Agent profile',
		schema: agentProfileRowSchema,
		scanExemptPaths: AGENT_PROFILE_SCAN_EXEMPT_PATHS
	})
]);
