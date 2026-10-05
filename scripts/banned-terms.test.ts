// Banned-terms copy-compliance gate: pure rules table, UI-SPEC negatives, CLI non-vacuity against
// throwaway trees under os.tmpdir(), and real-scope coverage. Nothing here writes into this repo.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';
import { collectFiles } from './banned-terms.mjs';
import { EXCLUDED, SCANNED_EXT, findBanned } from './lib/banned-terms-rules.mjs';

const REPO_ROOT = join(import.meta.dirname, '..');
const CLI = join(import.meta.dirname, 'banned-terms.mjs');
const PAGE = 'apps/web/src/routes/(marketing)/+page.svelte';

const runCli = (root: string) => {
	const r = spawnSync(process.execPath, [CLI, '--root', root], { encoding: 'utf8' });
	if (r.error) throw r.error;
	return { status: r.status ?? 1, out: r.stdout + r.stderr };
};

const withTree = (files: Record<string, string>, fn: (dir: string) => void) => {
	const dir = mkdtempSync(join(tmpdir(), 'banned-'));
	try {
		for (const [rel, text] of Object.entries(files)) {
			const abs = join(dir, rel);
			mkdirSync(dirname(abs), { recursive: true });
			writeFileSync(abs, text);
		}
		fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};

describe('findBanned rules', () => {
	const positives = [
		'appraisal',
		'Appraisals',
		'appraise',
		'appraised',
		'guaranteed',
		'Guarantees',
		'guaranty',
		'best investment',
		'best\n\t\tinvestments',
		'we represent',
		'We\nrepresent',
		'brokerage services',
		'risk-free',
		'risk free',
		'will appreciate',
		'passive income',
		'testimonial',
		'Testimonials',
		'rated 5',
		'five-star',
		'5 star',
		'★',
		'&#9733;',
		'&starf;',
		'trusted by',
		'Thousands of'
	];
	test.each(positives)('flags %j', (text) => {
		expect(findBanned('x.svelte', text).length).toBeGreaterThanOrEqual(1);
	});

	const negatives = [
		'They are not professional valuations of a property and can be wrong.',
		'provided as is, without warranties of any kind',
		'Tran Real Estate Tools is not a real estate brokerage and does not act as an agent for anyone.',
		'with your license and brokerage disclosures added',
		'a representative sample',
		'guarantor',
		'Equal Housing Opportunity'
	];
	test.each(negatives)('accepts %j', (text) => {
		expect(findBanned('x.svelte', text)).toEqual([]);
	});

	test('reports file and line of a planted "guaranteed returns" line', () => {
		const hits = findBanned('a.svelte', 'ok\nguaranteed returns');
		expect(hits).toHaveLength(1);
		expect(hits[0]).toContain('a.svelte:2');
		expect(hits[0]).toContain('guarantee');
	});

	test('is stateless across calls', () => {
		expect(findBanned('a.svelte', 'guaranteed')).toHaveLength(1);
		expect(findBanned('a.svelte', 'guaranteed')).toHaveLength(1);
	});
});

describe('banned-terms CLI', () => {
	test('fails on a planted "guaranteed returns" page', () => {
		withTree({ [PAGE]: '<p>Get guaranteed returns today.</p>\n' }, (dir) => {
			const r = runCli(dir);
			expect(r.status).toBe(1);
			expect(r.out).toContain('guarantee');
		});
	});

	test('fails on a phrase Prettier split across lines', () => {
		withTree({ [PAGE]: '<p>\n\tThe best\n\tinvestment in town.\n</p>\n' }, (dir) => {
			const r = runCli(dir);
			expect(r.status).toBe(1);
			expect(r.out).toContain('best investment');
		});
	});

	test('passes clean copy and reports the file count', () => {
		withTree({ [PAGE]: '<p>They are not professional valuations.</p>\n' }, (dir) => {
			const r = runCli(dir);
			expect(r.status).toBe(0);
			expect(r.out).toContain('Banned-terms check passed (1 files)');
		});
	});

	test('fails closed when the scope holds zero files', () => {
		withTree({ 'README.md': 'guaranteed\n' }, (dir) => {
			const r = runCli(dir);
			expect(r.status).toBe(1);
			expect(r.out).toContain('misconfigured');
		});
	});

	test('does not scan test/spec files inside scope', () => {
		withTree(
			{
				[PAGE]: '<p>Clean copy.</p>\n',
				'apps/web/src/routes/(marketing)/x.test.ts': "expect('guaranteed');\n"
			},
			(dir) => {
				expect(collectFiles(dir)).toEqual([PAGE]);
				const r = runCli(dir);
				expect(r.status).toBe(0);
				expect(r.out).toContain('Banned-terms check passed (1 files)');
			}
		);
	});

	test('exits 0 on the real repository', () => {
		const r = runCli(REPO_ROOT);
		expect(r.out).toContain('Banned-terms check passed (');
		expect(r.status).toBe(0);
	});
});

describe('real scope coverage', () => {
	const walk = (d: string): string[] =>
		readdirSync(d).flatMap((f) =>
			statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]
		);

	test('collectFiles includes every .svelte file under apps/web/src/routes', () => {
		const files = collectFiles(REPO_ROOT);
		expect(files.length).toBeGreaterThan(0);
		const routes = walk(join(REPO_ROOT, 'apps/web/src/routes'))
			.filter((f) => f.endsWith('.svelte'))
			.map((f) => relative(REPO_ROOT, f).split(sep).join('/'));
		expect(routes.length).toBeGreaterThan(0);
		for (const r of routes) expect(files).toContain(r);
	});

	test('every collected file matches the scanned extensions and is not excluded', () => {
		for (const f of collectFiles(REPO_ROOT)) {
			expect(f).toMatch(SCANNED_EXT);
			expect(f).not.toMatch(EXCLUDED);
		}
	});
});
