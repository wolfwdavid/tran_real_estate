// Text oracle for docs/DEPLOY-CHECKLIST.md (12-05, rewritten in Phase 13 to the personal-account
// reality: wolfwdavid/tran_real_estate served at https://wolfwdavid.github.io/tran_real_estate/).
// The checklist is the owner's one-time go-live record, so its step order, hosts and
// cross-referenced numbers are load-bearing: other files cite "Step 5", "Step 7", "8.1.3",
// "8.1.8" and "8.7" and must stay true without edits.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const DOC = readFileSync(join(ROOT, 'docs/DEPLOY-CHECKLIST.md'), 'utf8').replace(/\r\n/g, '\n');
/** The doc with every whitespace run collapsed, for prose that Prettier may re-wrap. */
const FLAT = DOC.replace(/\s+/g, ' ');
const EVIDENCE = readFileSync(join(ROOT, 'scripts/lib/pitfalls-evidence.mjs'), 'utf8');

const HEADINGS = [
	'## Step 1: Use the owner account (no organization)',
	'## Step 2: Create an empty public repository named exactly `tran_real_estate`',
	'## Step 3: Set the Pages source to GitHub Actions',
	'## Step 4: Turn on Dependabot alerts and security updates',
	'## Step 5: Enable secret scanning and push protection',
	'## Step 6: Push `main` with `PAGES_ENABLED` unset, wait for green CI, then go live',
	'## Step 7: Verify the live origin',
	'## Step 8: Launch services (Phase 10)',
	'## Step 9: Browser extension release (Phase 11)'
];

/** Text from `## Step n:` up to (not including) the next `## ` heading. */
function section(n: number, text = DOC): string {
	const start = text.indexOf(`\n## Step ${n}:`);
	if (start === -1) throw new Error(`no Step ${n} heading`);
	const next = text.indexOf('\n## ', start + 1);
	return text.slice(start + 1, next === -1 ? undefined : next);
}

/** Numbered list lines at exactly `indent` spaces: their numbers and first lines. */
function numberedItems(text: string, indent: number): { n: number; line: string }[] {
	const re = new RegExp(`^ {${indent}}(\\d+)\\. (.*)$`, 'gm');
	return [...text.matchAll(re)].map((m) => ({ n: Number(m[1]), line: m[2] }));
}

/** Step 8 item 1 (Umami): from the `1. ` line to the `2. ` top-level line. */
function umamiItem(): string {
	const s8 = section(8);
	const start = s8.search(/^1\. /m);
	const end = s8.search(/^2\. /m);
	return s8.slice(start, end);
}

describe('step order', () => {
	test('the nine Step headings appear in the locked order with the locked titles', () => {
		const found = DOC.split('\n').filter((l) => l.startsWith('## Step'));
		expect(found).toEqual(HEADINGS);
	});

	test('Step 2 says to create the repository empty', () => {
		expect(section(2)).toMatch(/do not add a README, licence or \.gitignore/);
		expect(section(2)).toMatch(/non-fast-forward/);
	});

	test('Step 3 is done before Step 6 and explains the 404 on create deployment', () => {
		const s3 = section(3);
		expect(s3).toMatch(/\*\*GitHub Actions\*\*/);
		expect(s3).toMatch(/before Step 6/);
		expect(s3).toMatch(/github-pages/);
		expect(s3).toMatch(/HTTP 404/);
	});

	test('Step 4 holds the Dependabot instructions', () => {
		expect(section(4)).toMatch(/Dependabot alerts and Dependabot security updates/);
		expect(section(4)).toMatch(/pnpm audit/);
	});

	test('Step 5 is turned on before the first push', () => {
		expect(section(5)).toMatch(/before the first push in Step 6/);
	});

	test('Step 6 pushes first, waits for CI, sets the origin variables, rehearses, then goes live', () => {
		const s6 = section(6);
		const remote = s6.indexOf(
			'git remote add origin https://github.com/wolfwdavid/tran_real_estate.git'
		);
		const push = s6.indexOf('git push -u origin main');
		const green = s6.search(/go green/);
		const vars = s6.search(/MSYS_NO_PATHCONV=1 gh variable set BASE_PATH/);
		const rehearse = s6.indexOf('chore: rehearse sub-path deploy build');
		const variable = s6.search(/`PAGES_ENABLED` with the value `true`/);
		const empty = s6.indexOf('git commit --allow-empty -m "chore: go live"');
		for (const i of [remote, push, green, vars, rehearse, variable, empty]) {
			expect(i).toBeGreaterThan(-1);
		}
		expect(remote).toBeLessThan(push);
		expect(push).toBeLessThan(green);
		expect(green).toBeLessThan(vars);
		expect(vars).toBeLessThan(rehearse);
		expect(rehearse).toBeLessThan(variable);
		expect(variable).toBeLessThan(empty);
		expect(s6).toMatch(/never adds a remote/);
		expect(s6).toMatch(/Setting the variable alone deploys nothing/);
		expect(s6).toMatch(/`workflow_dispatch` is excluded from the gate/);
		expect(DOC.split('git commit --allow-empty -m "chore: go live"')).toHaveLength(2);
	});

	test('Steps 1-6 carry the completion marker', () => {
		for (const n of [1, 2, 3, 4, 5, 6]) {
			expect(section(n), `Step ${n}`).toMatch(/\*\*Completed 2026-10-29/);
		}
	});
});

describe('personal-account origin', () => {
	test('the checklist names only the real origin', () => {
		expect(DOC).not.toMatch(/tranrealestate/);
		expect(DOC).toMatch(/https:\/\/wolfwdavid\.github\.io\/tran_real_estate\//);
	});

	test('PUBLIC_SITE_URL is the origin only and BASE_PATH is set', () => {
		expect(FLAT).toContain('--body "https://wolfwdavid.github.io"');
		expect(FLAT).toContain('--body "/tran_real_estate"');
		expect(FLAT).not.toContain('--body "https://wolfwdavid.github.io/tran_real_estate');
	});

	test('Step 8 notes that a project robots.txt is ignored', () => {
		const s8 = section(8);
		const item4 = s8.slice(s8.search(/^4\. /m), s8.search(/^5\. /m));
		expect(item4).toMatch(/robots\.txt/);
	});
});

describe('hosts and probes', () => {
	test('names the Umami gateway host and never cloud.umami.is', () => {
		expect(DOC).not.toMatch(/cloud\.umami\.is/);
		expect(DOC.match(/gateway\.umami\.is/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
		expect(DOC).toMatch(/PUBLIC_ANALYTICS_HOST=https:\/\/gateway\.umami\.is/);
	});

	test('carries exactly one curl POST probe with a real-id placeholder and the 404 explanation', () => {
		expect(DOC.split('curl -i -X POST https://gateway.umami.is/api/send')).toHaveLength(2);
		expect(DOC).toMatch(/"website":"<your website id>"/);
		expect(DOC).toMatch(/Website not found/);
		expect(FLAT).toMatch(/host OR the website id is wrong/);
		expect(FLAT).toMatch(/counts one pageview/);
	});

	test('Search Console uses the HTML-tag method and the app.html slot', () => {
		const s8 = section(8);
		const item4 = s8.slice(s8.search(/^4\. /m), s8.search(/^5\. /m));
		expect(item4).toMatch(/\*\*Search Console\.\*\*/);
		expect(item4).toMatch(/HTML-tag method only/);
		expect(item4).toMatch(/`apps\/web\/src\/app\.html`/);
		expect(item4).toMatch(/%sveltekit\.head%/);
		expect(item4).toMatch(/google-site-verification/);
		expect(item4).toMatch(/<!-- search-console: \.\.\. -->/);
		expect(item4).toMatch(/sitemap\.xml/);
		expect(item4).toMatch(/14 URLs/);
	});
});

describe('fresh-profile rule', () => {
	test('appears exactly twice: Step 7 and Step 8', () => {
		expect(DOC.match(/\*\*Fresh-profile rule:\*\*/g)).toHaveLength(2);
		expect(section(7)).toMatch(/\*\*Fresh-profile rule:\*\*/);
		expect(section(8)).toMatch(/\*\*Fresh-profile rule:\*\*/);
	});

	test('Step 7 items 1-5 each run in InPrivate; items 6-7 are kept', () => {
		const items = numberedItems(section(7), 0);
		expect(items.map((i) => i.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		for (const item of items.slice(0, 5)) expect(item.line).toMatch(/InPrivate/);
		expect(section(7)).toMatch(/\.nojekyll/);
		expect(section(7)).toMatch(/push-protection-probe/);
		expect(section(7)).toMatch(/TRANCANARY_/);
	});

	test('the Umami GPC and normal-browser checks run in a fresh InPrivate window', () => {
		const subs = numberedItems(umamiItem(), 3);
		expect(subs[5].line).toMatch(/^From the live origin in a fresh InPrivate window/);
		expect(subs[6].line).toMatch(/fresh InPrivate window/);
	});
});

describe('stable numbering (live cross-references)', () => {
	test('every "DEPLOY-CHECKLIST.md Step N" in pitfalls-evidence names a real heading', () => {
		const cited = [...EVIDENCE.matchAll(/DEPLOY-CHECKLIST\.md Step (\d+)/g)].map((m) =>
			Number(m[1])
		);
		expect(cited.length).toBeGreaterThan(0);
		for (const n of cited) expect(() => section(n)).not.toThrow();
		const expected: Record<number, RegExp> = {
			5: /secret scanning and push protection/i,
			7: /Verify the live origin/
		};
		for (const [n, re] of Object.entries(expected)) {
			expect(section(Number(n)).split('\n')[0]).toMatch(re);
		}
		expect(cited).toEqual(expect.arrayContaining([5, 7]));
	});

	test('Step 8 top-level items 1-7 keep their numbers and roles', () => {
		const top = numberedItems(section(8), 0);
		expect(top.map((i) => i.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(top[0].line).toMatch(/Umami/);
		expect(top[3].line).toMatch(/^\*\*Search Console\.\*\*/);
		expect(top[5].line).toMatch(/^\*\*Dependabot\.\*\*/);
		expect(top[5].line).toMatch(/Step 4/);
		expect(top[6].line).toMatch(/^\*\*Record the results\*\*/);
	});

	test('Umami sub-steps are exactly 1-9 with 8.1.3 and 8.1.8 in place', () => {
		const subs = numberedItems(umamiItem(), 3);
		expect(subs.map((i) => i.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
		const sub3 = umamiItem().slice(
			umamiItem().search(/^ {3}3\. /m),
			umamiItem().search(/^ {3}4\. /m)
		);
		expect(sub3).toMatch(/IP addresses are not stored/);
		expect(subs[7].line).toMatch(/^\*\*Apply the cut line\*\*/);
	});

	test('the curl probe sits inside sub-step 4, unnumbered', () => {
		const item = umamiItem();
		const sub4 = item.slice(item.search(/^ {3}4\. /m), item.search(/^ {3}5\. /m));
		expect(sub4).toMatch(/curl -i -X POST/);
		const curlLine = DOC.split('\n').find((l) => l.includes('curl -i -X POST')) ?? '';
		expect(curlLine).not.toMatch(/^\s*\d+\. /);
	});

	test('Step 9 cross-references point at the renumbered steps', () => {
		const s9 = section(9);
		expect(s9).toMatch(/\(needs Steps 1-7\)/);
		expect(s9).toMatch(/After Step 6 \(the remote exists\)/);
		expect(s9).not.toMatch(/After Step 3/);
	});
});
