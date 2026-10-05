// Proves the real-data guard is non-vacuous on the committed sample fixtures: clean files pass,
// and a planted value of every real-data category in a copy of every file fails.
// Every planted value is assembled from fragments so this file never carries a real-looking literal.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { FIXTURE_FILES } from './gen-fixtures.mjs';
import { findProblems } from './lib/real-data-rules.mjs';

const j = (...parts: string[]) => parts.join('');
const repoRoot = join(import.meta.dirname, '..');
const REL_DIR = 'apps/web/src/lib/data/fixtures';

const PLANTS: Array<[category: string, key: string, value: string]> = [
	['agent phone', 'phone', j('512', '994', '8203')],
	['agent email', 'email', j('agent', '@', 'brokerage', '.com')],
	['zip code', 'zipCode', j('787', '01')],
	['website host', 'website', 'https://' + j('zil', 'low', '.com')],
	['mls number', 'mlsNumber', j('AB', 'OR', '1', '2345')],
	['listing id', 'id', j('LST', '-', '99')]
];

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const readFixture = (name: string) => readFileSync(join(repoRoot, REL_DIR, name), 'utf8');

// Depth-first: the first object that already carries `key`.
function findCarrier(node: Json, key: string): Record<string, Json> | undefined {
	if (Array.isArray(node)) {
		for (const item of node) {
			const hit = findCarrier(item, key);
			if (hit) return hit;
		}
		return undefined;
	}
	if (node !== null && typeof node === 'object') {
		if (Object.hasOwn(node, key)) return node;
		for (const value of Object.values(node)) {
			const hit = findCarrier(value, key);
			if (hit) return hit;
		}
	}
	return undefined;
}

function plant(text: string, key: string, value: string): string {
	const data = JSON.parse(text) as Json;
	const carrier = findCarrier(data, key);
	if (carrier) {
		carrier[key] = value;
	} else if (Array.isArray(data)) {
		data.push({ [key]: value });
	} else if (data !== null && typeof data === 'object') {
		data.plantedRecord = { [key]: value };
	}
	return JSON.stringify(data, null, '\t');
}

describe('committed fixtures are clean', () => {
	test.each(FIXTURE_FILES)('%s yields no guard problems', (name) => {
		expect(findProblems(`${REL_DIR}/${name}`, readFixture(name))).toEqual([]);
	});
});

describe('planted real-data values are flagged in every fixture file', () => {
	const cases = FIXTURE_FILES.flatMap((name) =>
		PLANTS.map(([category, key, value]) => ({ name, category, key, value }))
	);

	test.each(cases)('$name: planted $category is flagged', ({ name, key, value }) => {
		const original = readFixture(name);
		const planted = plant(original, key, value);
		expect(planted).toContain(value);
		// Same content, unplanted, re-serialized identically: proves the plant alone trips the guard.
		expect(
			findProblems(`${REL_DIR}/${name}`, JSON.stringify(JSON.parse(original), null, '\t'))
		).toEqual([]);
		expect(findProblems(`${REL_DIR}/${name}`, planted).length).toBeGreaterThanOrEqual(1);
	});
});
