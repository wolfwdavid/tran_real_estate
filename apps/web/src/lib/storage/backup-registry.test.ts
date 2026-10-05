import { afterEach, describe, expect, it } from 'vitest';
import {
	BACKUP_EXCLUDED_TABLES,
	_resetBackupRegistry,
	listBackupTables,
	registerBackupTable
} from './backup-registry';
import { AI_BACKUP_TABLES } from '$lib/ai/storage/tables';
import { PHASE4_BACKUP_TABLES } from '$lib/data/tables';
import { RENTER_BACKUP_TABLES } from '$lib/features/renter/storage/tables';
import { TranDb } from './db';

/** Built-in registrations: Phase 3 prefs, Phase 4 data tables, Phase 5 AI drafts, Phase 6 renter. */
const DEFAULTS = [
	{ name: 'prefs', label: 'Settings' },
	...PHASE4_BACKUP_TABLES,
	...AI_BACKUP_TABLES,
	...RENTER_BACKUP_TABLES
];
const DEFAULT_NAMES = DEFAULTS.map((t) => t.name);

afterEach(() => {
	_resetBackupRegistry();
});

describe('backup registry', () => {
	it('registers prefs as "Settings" (then the Phase 4 data tables) by default', () => {
		expect(listBackupTables()).toEqual(DEFAULTS);
		expect(listBackupTables()[0]).toEqual({ name: 'prefs', label: 'Settings' });
	});

	it('appends new tables in registration order', () => {
		registerBackupTable({ name: 'savedSearches', label: 'Saved searches' });
		registerBackupTable({ name: 'notes', label: 'Notes' });
		expect(listBackupTables().map((t) => t.name)).toEqual([...DEFAULT_NAMES, 'notes']);
	});

	it('replaces the label when a name is registered again, keeping its position', () => {
		registerBackupTable({ name: 'notes', label: 'Notes' });
		registerBackupTable({ name: 'prefs', label: 'Preferences' });
		expect(listBackupTables()).toEqual([
			{ name: 'prefs', label: 'Preferences' },
			...PHASE4_BACKUP_TABLES,
			...AI_BACKUP_TABLES,
			...RENTER_BACKUP_TABLES,
			{ name: 'notes', label: 'Notes' }
		]);
	});

	it('refuses to register an excluded table', () => {
		expect(() => registerBackupTable({ name: 'meta', label: 'Meta' })).toThrow();
		expect(listBackupTables().some((t) => t.name === 'meta')).toBe(false);
	});

	it('returns a snapshot that callers cannot mutate into the registry', () => {
		const list = listBackupTables() as { name: string; label: string }[];
		expect(() => list.push({ name: 'x', label: 'X' })).toThrow();
		expect(listBackupTables()).toHaveLength(DEFAULTS.length);
	});

	it('_resetBackupRegistry restores the default', () => {
		registerBackupTable({ name: 'notes', label: 'Notes' });
		_resetBackupRegistry();
		expect(listBackupTables()).toEqual(DEFAULTS);
	});

	it('excludes meta, and is frozen', () => {
		expect(BACKUP_EXCLUDED_TABLES).toContain('meta');
		expect(BACKUP_EXCLUDED_TABLES).toContain('apiCache');
		expect(Object.isFrozen(BACKUP_EXCLUDED_TABLES)).toBe(true);
	});

	it("registers aiArtifacts as 'AI drafts' by default", () => {
		expect(listBackupTables()).toContainEqual({ name: 'aiArtifacts', label: 'AI drafts' });
	});

	it('every TranDb table is registered XOR excluded', () => {
		const registered = new Set(listBackupTables().map((t) => t.name));
		const excluded = new Set(BACKUP_EXCLUDED_TABLES);
		const tables = new TranDb({}).tables.map((t) => t.name);
		expect(tables.length).toBeGreaterThan(0);
		for (const name of tables) {
			expect(registered.has(name) !== excluded.has(name), name).toBe(true);
		}
	});
});
