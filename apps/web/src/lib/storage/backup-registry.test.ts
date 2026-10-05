import { afterEach, describe, expect, it } from 'vitest';
import {
	BACKUP_EXCLUDED_TABLES,
	_resetBackupRegistry,
	listBackupTables,
	registerBackupTable
} from './backup-registry';
import { TranDb } from './db';

afterEach(() => {
	_resetBackupRegistry();
});

describe('backup registry', () => {
	it('registers prefs as "Settings" by default', () => {
		expect(listBackupTables()).toEqual([{ name: 'prefs', label: 'Settings' }]);
	});

	it('appends new tables in registration order', () => {
		registerBackupTable({ name: 'savedSearches', label: 'Saved searches' });
		expect(listBackupTables().map((t) => t.name)).toEqual(['prefs', 'savedSearches']);
	});

	it('replaces the label when a name is registered again, keeping its position', () => {
		registerBackupTable({ name: 'savedSearches', label: 'Saved searches' });
		registerBackupTable({ name: 'prefs', label: 'Preferences' });
		expect(listBackupTables()).toEqual([
			{ name: 'prefs', label: 'Preferences' },
			{ name: 'savedSearches', label: 'Saved searches' }
		]);
	});

	it('refuses to register an excluded table', () => {
		expect(() => registerBackupTable({ name: 'meta', label: 'Meta' })).toThrow();
		expect(listBackupTables().some((t) => t.name === 'meta')).toBe(false);
	});

	it('returns a snapshot that callers cannot mutate into the registry', () => {
		const list = listBackupTables() as { name: string; label: string }[];
		expect(() => list.push({ name: 'x', label: 'X' })).toThrow();
		expect(listBackupTables()).toHaveLength(1);
	});

	it('_resetBackupRegistry restores the default', () => {
		registerBackupTable({ name: 'savedSearches', label: 'Saved searches' });
		_resetBackupRegistry();
		expect(listBackupTables()).toEqual([{ name: 'prefs', label: 'Settings' }]);
	});

	it('excludes meta, and is frozen', () => {
		expect(BACKUP_EXCLUDED_TABLES).toContain('meta');
		expect(Object.isFrozen(BACKUP_EXCLUDED_TABLES)).toBe(true);
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
