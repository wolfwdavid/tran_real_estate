// Determinism, drift detection and shape counts for scripts/gen-fixtures.mjs (DATA-01).
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { ANCHOR, FIXTURE_FILES, generateFixtureData } from './gen-fixtures.mjs';

const repoRoot = join(import.meta.dirname, '..');
const FIXTURE_DIR = join(repoRoot, 'apps/web/src/lib/data/fixtures');
const DAY_MS = 86_400_000;

type Contact = { phone?: string } | null;
type Listing = {
	id: string;
	listedDate: string;
	listingAgent: Contact;
	listingOffice: Contact;
	builder: Contact;
};
type MarketSide = { history: Record<string, unknown> };
type Market = { zipCode: string; saleData: MarketSide; rentalData: MarketSide };

const data = generateFixtureData() as unknown as {
	'rentals.json': Listing[];
	'sales.json': Listing[];
	'estimates.json': { rent: unknown[]; sale: unknown[] };
	'markets.json': Market[];
};

const runCheck = (dir: string) =>
	spawnSync(process.execPath, ['scripts/gen-fixtures.mjs', '--check', '--out', dir], {
		cwd: repoRoot,
		encoding: 'utf8'
	});

const tmpDirs: string[] = [];
afterAll(() => {
	for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

describe('determinism', () => {
	test('generateFixtureData() returns deep-equal data on every call', () => {
		expect(generateFixtureData()).toEqual(generateFixtureData());
	});

	test('the generator renders exactly the six committed files', () => {
		expect([...FIXTURE_FILES].sort()).toEqual(
			[
				'estimates.json',
				'markets.json',
				'meta.json',
				'metros.json',
				'rentals.json',
				'sales.json'
			].sort()
		);
	});
});

describe('drift check', () => {
	test('--check passes on an untouched copy and fails after a hand edit', () => {
		const dir = mkdtempSync(join(tmpdir(), 'fixtures-'));
		tmpDirs.push(dir);
		cpSync(FIXTURE_DIR, dir, { recursive: true });

		const clean = runCheck(dir);
		expect(clean.status, clean.stderr).toBe(0);
		expect(clean.stdout).toContain('Fixtures match generator output (6 files)');

		const file = join(dir, 'rentals.json');
		const text = readFileSync(file, 'utf8');
		const edited = text.replace(/"price": (\d+)/, (_m, price: string) => {
			return `"price": ${Number(price) + 25}`;
		});
		expect(edited).not.toBe(text);
		writeFileSync(file, edited);

		const drifted = runCheck(dir);
		expect(drifted.status).toBe(1);
		expect(drifted.stdout + drifted.stderr).toContain('Fixture drift: rentals.json');
	});

	test('--check reports a missing file as drift', () => {
		const dir = mkdtempSync(join(tmpdir(), 'fixtures-'));
		tmpDirs.push(dir);
		cpSync(FIXTURE_DIR, dir, { recursive: true });
		rmSync(join(dir, 'meta.json'));

		const result = runCheck(dir);
		expect(result.status).toBe(1);
		expect(result.stdout + result.stderr).toContain('Fixture drift: meta.json');
	});
});

describe('counts and shape', () => {
	const rentals = data['rentals.json'];
	const sales = data['sales.json'];

	test('60 rentals, 40 sales, 100 rent estimates, 40 sale estimates, 6 markets', () => {
		expect(rentals).toHaveLength(60);
		expect(sales).toHaveLength(40);
		expect(data['estimates.json'].rent).toHaveLength(100);
		expect(data['estimates.json'].sale).toHaveLength(40);
		expect(data['markets.json']).toHaveLength(6);
	});

	test('every market has 24 history months on both sides', () => {
		for (const market of data['markets.json']) {
			expect(Object.keys(market.saleData.history)).toHaveLength(24);
			expect(Object.keys(market.rentalData.history)).toHaveLength(24);
			expect(Object.keys(market.saleData.history)[0]).toBe('2024-10');
			expect(Object.keys(market.saleData.history).at(-1)).toBe('2026-09');
		}
	});

	test('at least 12 rentals and 8 sales are listed within 7 days of the anchor', () => {
		const anchor = Date.parse(ANCHOR);
		const recent = (list: Listing[]) =>
			list.filter((l) => anchor - Date.parse(l.listedDate) <= 7 * DAY_MS).length;
		expect(recent(rentals)).toBeGreaterThanOrEqual(12);
		expect(recent(sales)).toBeGreaterThanOrEqual(8);
	});

	test('every contact phone is a bare 10-digit 555-01xx number', () => {
		const phones = [...rentals, ...sales].flatMap((l) =>
			[l.listingAgent, l.listingOffice, l.builder].flatMap((c) => (c?.phone ? [c.phone] : []))
		);
		expect(phones.length).toBeGreaterThanOrEqual(200);
		for (const phone of phones) expect(phone).toMatch(/^\d{3}55501\d{2}$/);
	});

	test('ids are unique across rentals and sales', () => {
		const ids = [...rentals, ...sales].map((l) => l.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
