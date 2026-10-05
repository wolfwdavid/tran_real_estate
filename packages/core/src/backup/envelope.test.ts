import { describe, expect, test } from 'vitest';

import golden from './__fixtures__/backup-v1.json' with { type: 'json' };
import {
	BACKUP_APP_NAME,
	BACKUP_FORMAT,
	BACKUP_SCHEMA_VERSION,
	MAX_BACKUP_BYTES,
	buildEnvelope,
	parseBackup
} from './envelope.js';
import { BackupError, type BackupErrorCode } from './errors.js';
import { backupFilename } from './filename.js';
import type { MigrationRegistry } from './migrations.js';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const REC = {
	id: '00000000-0000-4000-8000-000000000001',
	ownerId: 'local' as const,
	createdAt: '2026-10-01T12:00:00.000Z',
	updatedAt: '2026-10-01T12:00:00.000Z',
	schemaVersion: 1,
	key: 'ui.density',
	value: 'comfortable'
};
const OPTS = { registeredTables: ['prefs'] } as const;

function envelopeText(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({ ...buildEnvelope({ prefs: [REC] }, NOW), ...overrides });
}

function codeOf(fn: () => unknown): BackupErrorCode | 'no-throw' | 'other' {
	try {
		fn();
		return 'no-throw';
	} catch (e) {
		return e instanceof BackupError ? e.code : 'other';
	}
}

describe('BackupError', () => {
	test('message and code are the fixed code, never file content', () => {
		const err = new BackupError('newer');
		expect(err.message).toBe('newer');
		expect(err.code).toBe('newer');
		expect(err.name).toBe('BackupError');
		expect(err).toBeInstanceOf(Error);
	});
});

describe('constants', () => {
	test('pin the format, version, size cap and app name', () => {
		expect(BACKUP_FORMAT).toBe('tran-backup-v1');
		expect(BACKUP_SCHEMA_VERSION).toBe(1);
		expect(MAX_BACKUP_BYTES).toBe(25 * 1024 * 1024);
		expect(BACKUP_APP_NAME).toBe('Tran Real Estate Tools');
	});
});

describe('buildEnvelope + parseBackup', () => {
	test('round-trips to an equal envelope with migratedFrom null', () => {
		const env = buildEnvelope({ prefs: [REC] }, NOW);
		expect(env).toEqual({
			format: 'tran-backup-v1',
			schemaVersion: 1,
			app: 'Tran Real Estate Tools',
			exportedAt: NOW.toISOString(),
			tables: { prefs: [REC] }
		});
		const parsed = parseBackup(JSON.stringify(env), OPTS);
		expect(parsed.migratedFrom).toBeNull();
		expect(parsed.envelope).toEqual(env);
	});

	test('the golden v1 fixture parses at the current version', () => {
		const parsed = parseBackup(JSON.stringify(golden), OPTS);
		expect(parsed.migratedFrom).toBeNull();
		expect(parsed.envelope.tables.prefs).toHaveLength(2);
		expect(parsed.envelope.tables.prefs?.[1]?.deletedAt).toBe('2026-10-02T12:00:00.000Z');
	});
});

describe('parseBackup error codes', () => {
	test.each([
		['truncated JSON', '{', 'not-json'],
		['empty text', '', 'not-json'],
		['an array', '[]', 'not-tran'],
		['null', 'null', 'not-tran'],
		['another format', '{"format":"x"}', 'not-tran'],
		['an empty object', '{}', 'not-tran']
	] as const)('%s -> %s', (_name, text, code) => {
		expect(codeOf(() => parseBackup(text, OPTS))).toBe(code);
	});

	test('a newer schemaVersion -> newer', () => {
		expect(codeOf(() => parseBackup(envelopeText({ schemaVersion: 2 }), OPTS))).toBe('newer');
	});

	test.each([
		['missing schemaVersion', { schemaVersion: undefined }],
		['non-integer schemaVersion', { schemaVersion: 1.5 }],
		['string schemaVersion', { schemaVersion: '1' }],
		['wrong app name', { app: 'Other' }],
		['bad exportedAt', { exportedAt: 'yesterday' }],
		['tables not an object', { tables: [] }]
	])('%s -> invalid', (_name, overrides) => {
		expect(codeOf(() => parseBackup(envelopeText(overrides), OPTS))).toBe('invalid');
	});

	test('a record owned by someone else -> invalid', () => {
		const text = envelopeText({ tables: { prefs: [{ ...REC, ownerId: 'remote' }] } });
		expect(codeOf(() => parseBackup(text, OPTS))).toBe('invalid');
	});

	test('a record with a non-uuid id -> invalid', () => {
		const text = envelopeText({ tables: { prefs: [{ ...REC, id: 'abc' }] } });
		expect(codeOf(() => parseBackup(text, OPTS))).toBe('invalid');
	});

	test('an unknown table -> invalid', () => {
		const text = envelopeText({ tables: { ghosts: [] } });
		expect(codeOf(() => parseBackup(text, OPTS))).toBe('invalid');
	});

	test('error messages never echo file content', () => {
		const secretish = 'PLANTED-CONTENT-MARKER';
		try {
			parseBackup(envelopeText({ app: secretish }), OPTS);
			expect.unreachable();
		} catch (e) {
			expect(String((e as Error).message)).not.toContain(secretish);
			expect(JSON.stringify(e)).not.toContain(secretish);
		}
	});
});

describe('parseBackup migrations', () => {
	test('an older file is migrated forward and reports migratedFrom', () => {
		const log: number[] = [];
		const registry: MigrationRegistry = {
			1: (t) => {
				log.push(1);
				return {
					...t,
					prefs: (t.prefs ?? []).map((r) => ({ ...(r as object), migrated: true }))
				};
			}
		};
		const parsed = parseBackup(envelopeText(), { ...OPTS, currentVersion: 2, registry });
		expect(log).toEqual([1]);
		expect(parsed.migratedFrom).toBe(1);
		expect(parsed.envelope.schemaVersion).toBe(2);
		expect(parsed.envelope.tables.prefs?.[0]).toMatchObject({ migrated: true });
	});

	test('a missing migration step -> invalid', () => {
		expect(
			codeOf(() => parseBackup(envelopeText(), { ...OPTS, currentVersion: 2, registry: {} }))
		).toBe('invalid');
	});
});

describe('backupFilename', () => {
	test('uses the LOCAL calendar date, zero-padded', () => {
		expect(backupFilename(new Date(2026, 0, 5, 23, 59))).toBe('tran-backup-2026-01-05.json');
		expect(backupFilename(new Date(2026, 11, 31, 0, 1))).toBe('tran-backup-2026-12-31.json');
	});

	test('defaults to now', () => {
		expect(backupFilename()).toMatch(/^tran-backup-\d{4}-\d{2}-\d{2}\.json$/);
	});
});
