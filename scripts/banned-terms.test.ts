// Banned-terms copy-compliance gate: pure rules table, UI-SPEC negatives, CLI non-vacuity against
// throwaway trees under os.tmpdir(), and real-scope coverage. Nothing here writes into this repo.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';
import { collectFiles } from './banned-terms.mjs';
import {
	AGENT_BANNED,
	AGENT_SCOPES,
	EXCLUDED,
	INVESTOR_BANNED,
	INVESTOR_SCOPES,
	RENTER_BANNED,
	RENTER_SCOPES,
	SCANNED_EXT,
	SCOPE,
	findBanned
} from './lib/banned-terms-rules.mjs';

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

describe('Phase 6 renter-scoped phrases (06-UI-SPEC)', () => {
	const RENTER = 'apps/web/src/lib/features/renter/x.svelte';

	test('non-vacuity: "This unit is still available" fails in a renter path', () => {
		const hits = findBanned(RENTER, 'This unit is still available');
		expect(hits.some((h) => h.includes('banned term "still available"'))).toBe(true);
		expect(hits[0]).toContain(`${RENTER}:1`);
	});

	test('scoping: the same line outside renter scopes is not flagged', () => {
		expect(
			findBanned('apps/web/src/lib/components/x.svelte', 'This unit is still available')
		).toEqual([]);
	});

	test('a phrase wrapped across lines is still caught', () => {
		const hits = findBanned(RENTER, 'Is it\n  available now?');
		expect(hits.some((h) => h.includes('"available now"'))).toBe(true);
	});

	const renterPositives = [
		'This unit is available',
		'Overpriced',
		'over-priced',
		'underpriced',
		'a good deal',
		'Bargains',
		'fair market value',
		'market value',
		'valuation report',
		'appraised at'
	];
	test.each(renterPositives)('flags %j in every renter scope', (text) => {
		for (const scope of RENTER_SCOPES) {
			expect(findBanned(`${scope}x.svelte`, text).length, scope).toBeGreaterThanOrEqual(1);
		}
	});

	test('the renter list carries all eleven UI-SPEC phrases', () => {
		expect(RENTER_BANNED.map(([label]) => label)).toEqual([
			'is available',
			'still available',
			'available now',
			'overpriced',
			'underpriced',
			'good deal',
			'bargain',
			'fair market value',
			'market value',
			'valuation report',
			'appraised'
		]);
	});

	const renterNegatives = [
		'Availability and move-in timing',
		'Last seen listed 3 days ago',
		"It's an automated estimate, not a professional valuation, and it isn't a figure a landlord has to accept.",
		'12% above the median rent',
		'about the same as the median'
	];
	test.each(renterNegatives)('accepts UI-SPEC renter copy %j', (text) => {
		expect(findBanned(RENTER, text)).toEqual([]);
	});

	test('SCOPE contains the three Phase 6 folders', () => {
		expect(SCOPE).toEqual(
			expect.arrayContaining([
				'apps/web/src/lib/features/renter',
				'apps/web/src/lib/features/shared/listings',
				'apps/web/src/lib/features/shared/affordability'
			])
		);
	});

	test('CLI fails on a planted renter route line and passes the same line elsewhere', () => {
		withTree(
			{ 'apps/web/src/routes/(app)/renter/+page.svelte': '<p>This unit is still available.</p>\n' },
			(dir) => {
				const r = runCli(dir);
				expect(r.status).toBe(1);
				expect(r.out).toContain('still available');
			}
		);
		withTree({ [PAGE]: '<p>This unit is still available.</p>\n' }, (dir) => {
			expect(runCli(dir).status).toBe(0);
		});
	});

	test('CLI scans the new feature folders (non-vacuity for the extended SCOPE)', () => {
		for (const rel of [
			'apps/web/src/lib/features/renter/a.svelte',
			'apps/web/src/lib/features/shared/listings/b.svelte',
			'apps/web/src/lib/features/shared/affordability/c.svelte'
		]) {
			withTree({ [rel]: '<p>Guaranteed approval.</p>\n' }, (dir) => {
				expect(collectFiles(dir)).toEqual([rel]);
				const r = runCli(dir);
				expect(r.status, rel).toBe(1);
			});
		}
	});
});

describe('Phase 7 investor-scoped phrases (07-UI-SPEC Copywriting Contract)', () => {
	const INVESTOR = 'apps/web/src/lib/features/investor/x.svelte';

	const positives: Array<[string, string]> = [
		['cash cow', 'This duplex is a cash cow.'],
		["can't lose", 'At this price you can’t lose.'],
		['no-brainer', 'Buying here is a no-brainer.'],
		['great deal', 'A great deal for a starter rental.'],
		['good deal', 'That looks like a good deal.'],
		['bad deal', 'Skip it, it is a bad deal.'],
		['you should buy', 'With these numbers you should buy it.'],
		['we recommend', 'We recommend making an offer.']
	];
	test.each(positives)('flags %j in investor copy', (label, text) => {
		const hits = findBanned(INVESTOR, `<p>${text}</p>\n`);
		expect(hits.some((h) => h.includes(`banned term "${label}"`))).toBe(true);
	});

	test.each([
		'Compare deals',
		'Highest or Lowest marks the top figure in each row',
		'Not investment, legal, or tax advice. Tran is software, not a brokerage.',
		'Analyze a property, save the deals you want to revisit, and watch the ZIP codes you care about.'
	])('accepts UI-SPEC investor copy %j', (text) => {
		expect(findBanned(INVESTOR, text)).toEqual([]);
	});

	test('a phrase wrapped across lines is still caught', () => {
		expect(findBanned(INVESTOR, '<p>\n\tWe\n\trecommend this one.\n</p>')).toHaveLength(1);
	});

	test('scoping: the same line outside investor scopes is not flagged', () => {
		expect(findBanned(PAGE, '<p>We recommend making an offer.</p>')).toEqual([]);
	});

	test('the investor list carries all eight UI-SPEC phrases', () => {
		expect(INVESTOR_BANNED.map(([label]) => label)).toEqual([
			'cash cow',
			"can't lose",
			'no-brainer',
			'great deal',
			'good deal',
			'bad deal',
			'you should buy',
			'we recommend'
		]);
	});

	test('every investor scope applies the list, and SCOPE scans the four Phase 7 folders', () => {
		for (const scope of INVESTOR_SCOPES) {
			expect(findBanned(`${scope}x.svelte`, 'A no-brainer.'), scope).toHaveLength(1);
		}
		expect(INVESTOR_SCOPES).toEqual(
			expect.arrayContaining([
				'apps/web/src/routes/(app)/investor/',
				'apps/web/src/routes/(print)/print/memo/'
			])
		);
		expect(SCOPE).toEqual(
			expect.arrayContaining([
				'apps/web/src/lib/features/investor',
				'apps/web/src/lib/features/shared/markets',
				'apps/web/src/lib/features/shared/print',
				'apps/web/src/lib/features/shared/nav'
			])
		);
	});

	test('the real scan includes investor feature code', () => {
		expect(
			collectFiles(REPO_ROOT).some((f) => f.startsWith('apps/web/src/lib/features/investor/'))
		).toBe(true);
	});

	test('CLI fails on planted investor lines in every new folder and route', () => {
		for (const rel of [
			'apps/web/src/lib/features/investor/x.svelte',
			'apps/web/src/lib/features/shared/markets/x.svelte',
			'apps/web/src/lib/features/shared/print/x.svelte',
			'apps/web/src/lib/features/shared/nav/x.svelte',
			'apps/web/src/routes/(app)/investor/+page.svelte',
			'apps/web/src/routes/(print)/print/memo/+page.svelte'
		]) {
			withTree({ [rel]: '<p>This one is a cash cow.</p>\n' }, (dir) => {
				expect(collectFiles(dir)).toEqual([rel]);
				const r = runCli(dir);
				expect(r.status, rel).toBe(1);
				expect(r.out).toContain('cash cow');
			});
		}
		withTree({ [PAGE]: '<p>This one is a cash cow.</p>\n' }, (dir) => {
			expect(runCli(dir).status).toBe(0);
		});
	});
});

describe('Phase 8 agent-scoped phrases (08-UI-SPEC voice rules)', () => {
	const AGENT = 'apps/web/src/lib/features/agent/crm/x.svelte';

	test.each([
		['sync', 'We sync your leads.'],
		['inbox connection', 'Set up an inbox connection.'],
		['automatically sends', 'Tran automatically sends a reply.'],
		['sms consent', 'I agree to SMS consent terms.'],
		['auto-reply', 'Turn on auto-reply.']
	])('flags %j in agent copy', (label, text) => {
		const hits = findBanned(AGENT, `<p>${text}</p>\n`);
		expect(hits.some((h) => h.includes(`"${label}"`))).toBe(true);
	});

	test.each([
		'Copy the draft, then send it from your own email.',
		'Saved on this device only.',
		'async function load() {}'
	])('accepts agent copy %j', (text) => {
		expect(findBanned(AGENT, text)).toEqual([]);
	});

	test('scoping: agent phrases outside agent scopes are not flagged', () => {
		expect(findBanned(PAGE, 'We sync your leads.')).toEqual([]);
	});

	test('every agent scope applies the list, and SCOPE scans the agent folders', () => {
		for (const scope of AGENT_SCOPES) {
			expect(findBanned(`${scope}x.svelte`, 'Turn on auto-reply.'), scope).toHaveLength(1);
		}
		expect(AGENT_BANNED.length).toBeGreaterThan(0);
		expect(SCOPE).toEqual(
			expect.arrayContaining(['apps/web/src/lib/features/agent', 'apps/web/src/lib/leads'])
		);
	});

	test('CLI fails on global banned terms planted in features/agent and lib/leads', () => {
		for (const [rel, text, needle] of [
			['apps/web/src/lib/features/agent/crm/x.svelte', '<p>guaranteed results</p>\n', 'guarantee'],
			['apps/web/src/lib/leads/x.ts', "export const t = 'we represent you';\n", 'we represent']
		]) {
			withTree({ [rel]: text }, (dir) => {
				expect(collectFiles(dir)).toEqual([rel]);
				const r = runCli(dir);
				expect(r.status, rel).toBe(1);
				expect(r.out).toContain(needle);
			});
		}
	});

	test('CLI fails on agent phrases in the agent routes and the public inquiry route', () => {
		for (const rel of [
			'apps/web/src/routes/(app)/agent/+page.svelte',
			'apps/web/src/routes/(public)/agent/inquire/+page.svelte'
		]) {
			withTree({ [rel]: '<p>Tran automatically sends a reply.</p>\n' }, (dir) => {
				const r = runCli(dir);
				expect(r.status, rel).toBe(1);
				expect(r.out).toContain('automatically sends');
			});
		}
		withTree({ [PAGE]: '<p>Tran automatically sends a reply.</p>\n' }, (dir) => {
			expect(runCli(dir).status).toBe(0);
		});
	});
});
