// SSR test for the import preview's "older backup" line (Phase 3, UI-SPEC backup import). The
// built site cannot reach this branch end to end yet: BACKUP_SCHEMA_VERSION is 1, so no older
// backup file exists to migrate from (packages/core/src/backup/migrations.test.ts keeps the
// version and the migration steps in lockstep). The branch is proven here instead, by rendering
// the panel with a preview that was migrated and one that was not.
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { planMerge, planReplace, newSyncable, type Syncable } from '@tran/core';
import type { ImportPreview } from '$lib/storage/backup';
import Harness from './testing/ImportPreviewHarness.svelte';

const MIGRATION_LINE =
	"This backup is from an older version of Tran. It will be updated as it's imported.";

function preview(migratedFrom: number | null): ImportPreview {
	const tables = [{ name: 'contacts', label: 'Contacts' }];
	const incoming: Record<string, Syncable[]> = {
		contacts: [
			newSyncable({
				id: '6f1c2b1e-4b8a-4d0e-9a51-3c7d2e8f4b01',
				now: new Date('2026-10-01T12:00:00Z'),
				schemaVersion: 1
			})
		]
	};
	return {
		fileName: 'tran-backup-2026-10-01.json',
		exportedAt: '2026-10-01T12:00:00.000Z',
		schemaVersion: 1,
		migratedFrom,
		merge: planMerge({}, incoming, tables),
		replace: planReplace({}, incoming, tables),
		tables: tables.map((t) => t.name),
		incoming
	};
}

const text = (p: ImportPreview) =>
	render(Harness, { props: { preview: p } })
		.body.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/&#39;|&apos;/g, "'");

describe('ImportPreview', () => {
	test('a migrated backup shows the older-version line', () => {
		const html = text(preview(1));
		expect(html).toContain('tran-backup-2026-10-01.json');
		expect(html).toContain(MIGRATION_LINE);
	});

	test('a current backup does not', () => {
		const html = text(preview(null));
		expect(html).toContain('tran-backup-2026-10-01.json');
		expect(html).not.toContain('older version of Tran');
	});
});
