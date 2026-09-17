// Table test over the RESEARCH Pitfall 10 case table for scripts/lib/real-data-rules.mjs.
// Every real-looking email or phone is assembled at runtime from fragments so this file never
// contains the kind of literal the guard exists to reject.
import { describe, expect, test } from 'vitest';
import {
	ALLOWED_EMAIL,
	COSTAR_PATH,
	DATA_PATH,
	EMAIL,
	PHONE,
	TEXT_EXT,
	findProblems,
	isFictionalPhone
} from './lib/real-data-rules.mjs';

const j = (...parts: string[]) => parts.join('');
const DATA_FILE = 'apps/web/src/lib/data/fixtures/sample.json';

const ALLOWED = [
	j('jane', '@', 'example', '.com'),
	j('x', '@', 'foo', '.test'),
	j('(512) ', '555', '-', '0142'),
	j('512', '-', '555', '-', '0199'),
	j('+1 512 ', '555', ' ', '0100'),
	j('512', '555', '0142')
];

const FLAGGED = [
	j('agent', '@', 'brokerage', '.com'),
	j('user', '@', 'examples', '.com'),
	j('512', '.', '555', '.', '1234'),
	j('212', '-', '867', '-', '5309'),
	j('a', '@', 'sub.', 'example', '.org')
];

const NOT_MATCHED = [j('78701', '-', '1234'), j('2026', '0913'), j('1.2.3', '-', '4567')];

describe('findProblems: content rules on a data-like text path', () => {
	test.each(ALLOWED)('allows %s', (value) => {
		expect(findProblems(DATA_FILE, value)).toEqual([]);
	});

	test.each(FLAGGED)('flags %s', (value) => {
		const problems = findProblems(DATA_FILE, value);
		expect(problems.length).toBeGreaterThanOrEqual(1);
		expect(problems[0]).toMatch(/real-looking (email|US phone)/);
		expect(problems[0]).toContain(`${DATA_FILE}:1:`);
	});

	test.each(NOT_MATCHED)('does not match %s', (value) => {
		expect(findProblems(DATA_FILE, value)).toEqual([]);
	});

	test('reports the line number of each problem', () => {
		const text = [
			'ok line',
			j('agent', '@', 'brokerage', '.com'),
			'ok',
			j('212-', '867-', '5309')
		].join('\n');
		const problems = findProblems(DATA_FILE, text);
		expect(problems).toHaveLength(2);
		expect(problems[0]).toContain(`${DATA_FILE}:2:`);
		expect(problems[1]).toContain(`${DATA_FILE}:4:`);
	});

	test('handles CRLF line endings and undefined text', () => {
		const text = ['a', j('user', '@', 'examples', '.com')].join('\r\n');
		expect(findProblems(DATA_FILE, text)[0]).toContain(`${DATA_FILE}:2:`);
		expect(findProblems(DATA_FILE, undefined as unknown as string)).toEqual([]);
	});
});

describe('findProblems: path rules', () => {
	test.each(['data/costar/export.json', 'apps/web/src/lib/CoStar-notes.md', 'COSTAR.csv'])(
		'flags the CoStar path %s regardless of content',
		(file) => {
			const problems = findProblems(file, '');
			expect(problems).toHaveLength(1);
			expect(problems[0]).toMatch(/costar/i);
		}
	);

	test('a CoStar-named data file reports the path AND its content', () => {
		const problems = findProblems('fixtures/costar.json', j('agent', '@', 'brokerage', '.com'));
		expect(problems).toHaveLength(2);
	});

	test('non-data paths are not content-scanned', () => {
		const file = 'apps/web/src/routes/(app)/agent/+page.svelte';
		expect(findProblems(file, j('agent', '@', 'brokerage', '.com'))).toEqual([]);
	});

	test('data-like paths with a non-text extension are not content-scanned', () => {
		expect(findProblems('fixtures/logo.png', j('agent', '@', 'brokerage', '.com'))).toEqual([]);
	});

	test.each([
		'fixtures/a.json',
		'apps/web/src/lib/data/x.ts',
		'mocks/y.js',
		'samples/z.csv',
		'seed/w.md',
		'packages/core/fixture/v.svelte'
	])('%s counts as a data-like text path', (file) => {
		expect(DATA_PATH.test(file) && TEXT_EXT.test(file)).toBe(true);
	});

	test.each(['metadata/x.json', 'src/database/y.ts', 'fixtures.json'])(
		'%s is not a data-like path',
		(file) => {
			expect(DATA_PATH.test(file)).toBe(false);
		}
	);
});

describe('isFictionalPhone', () => {
	test('555-01xx is fictional', () => {
		expect(isFictionalPhone('555', '0142')).toBe(true);
		expect(isFictionalPhone('555', '0100')).toBe(true);
		expect(isFictionalPhone('555', '0199')).toBe(true);
	});

	test('anything else is real-looking', () => {
		expect(isFictionalPhone('555', '1234')).toBe(false);
		expect(isFictionalPhone('867', '5309')).toBe(false);
		expect(isFictionalPhone('555', '0200')).toBe(false);
	});
});

describe('regex state safety', () => {
	test('repeat calls with the same flagged input return the same result', () => {
		const text = j('agent', '@', 'brokerage', '.com');
		const first = findProblems(DATA_FILE, text);
		const second = findProblems(DATA_FILE, text);
		const third = findProblems(DATA_FILE, text);
		expect(first).toHaveLength(1);
		expect(second).toEqual(first);
		expect(third).toEqual(first);
	});

	test('a dirty lastIndex on the exported global regexes does not leak into findProblems', () => {
		const text = j('agent', '@', 'brokerage', '.com') + ' ' + j('212-', '867-', '5309');
		EMAIL.lastIndex = 5;
		PHONE.lastIndex = 5;
		expect(findProblems(DATA_FILE, text)).toHaveLength(2);
		expect(findProblems(DATA_FILE, text)).toHaveLength(2);
	});

	test('the exported regexes carry the expected flags', () => {
		expect(EMAIL.flags).toContain('g');
		expect(PHONE.flags).toContain('g');
		expect(COSTAR_PATH.flags).toContain('i');
		expect(ALLOWED_EMAIL.test(j('x', '@', 'EXAMPLE', '.COM'))).toBe(true);
	});
});
