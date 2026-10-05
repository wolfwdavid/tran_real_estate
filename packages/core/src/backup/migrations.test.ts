import { describe, expect, test } from 'vitest';

import { BACKUP_SCHEMA_VERSION } from './envelope.js';
import { BackupError } from './errors.js';
import { migrateTables, migrations, type MigrationRegistry, type TablesMap } from './migrations.js';

describe('migrateTables', () => {
	test('runs each step in order from `from` up to `to`', () => {
		const log: string[] = [];
		const registry: MigrationRegistry = {
			1: (t) => {
				log.push('a');
				return { ...t, a: [] };
			},
			2: (t) => {
				log.push('b');
				return { ...t, b: [] };
			}
		};
		const out = migrateTables({ prefs: [] }, 1, 3, registry);
		expect(log).toEqual(['a', 'b']);
		expect(Object.keys(out).sort()).toEqual(['a', 'b', 'prefs']);
	});

	test('a missing step throws BackupError invalid', () => {
		const registry: MigrationRegistry = { 1: (t) => t };
		let caught: unknown;
		try {
			migrateTables({}, 1, 3, registry);
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(BackupError);
		expect((caught as BackupError).code).toBe('invalid');
	});

	test('from === to returns the input unchanged', () => {
		const tables: TablesMap = { prefs: [{ id: 'x' }] };
		expect(migrateTables(tables, 1, 1, {})).toBe(tables);
	});

	test('defaults to the current version and the real registry', () => {
		const tables: TablesMap = { prefs: [] };
		expect(migrateTables(tables, BACKUP_SCHEMA_VERSION)).toBe(tables);
	});
});

describe('migrations registry', () => {
	test('has a step for every version 1 .. BACKUP_SCHEMA_VERSION - 1 with no gaps', () => {
		const keys = Object.keys(migrations)
			.map(Number)
			.sort((x, y) => x - y);
		const expected = Array.from({ length: BACKUP_SCHEMA_VERSION - 1 }, (_, i) => i + 1);
		expect(keys).toEqual(expected);
	});

	test('is frozen', () => {
		expect(Object.isFrozen(migrations)).toBe(true);
	});
});
