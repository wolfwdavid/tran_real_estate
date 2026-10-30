// Pins the gate strings in .github/workflows/live-smoke.yml (SMOKE-04, 13-CONTEXT D-09..D-12).
// Read as TEXT on purpose: .github/ is Prettier-ignored so every if: stays on one line; actionlint
// (pnpm lint:workflows) covers structure.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const WORKFLOWS = join(import.meta.dirname, '../.github/workflows');
const SMOKE = join(WORKFLOWS, 'live-smoke.yml');
const CI = join(WORKFLOWS, 'ci.yml');
const ACTIONLINT = join(import.meta.dirname, 'actionlint.mjs');

const text = existsSync(SMOKE) ? readFileSync(SMOKE, 'utf8') : '';
const ci = readFileSync(CI, 'utf8');
const actionlint = readFileSync(ACTIONLINT, 'utf8');

// The whole job gate on ONE line. PAGES_ENABLED gates both triggers (stricter reading of D-09: no
// red runs while Pages is off); the workflow_run branch adds success + push + main, the only ci
// runs that deploy (a green workflow_dispatch of ci deploys nothing, and a fork PR branch can be
// named main).
const IF =
	"    if: vars.PAGES_ENABLED == 'true' && (github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push' && github.event.workflow_run.head_branch == 'main'))";

const DEPLOYED_URL =
	"${{ inputs.base_url || format('{0}{1}/', vars.PUBLIC_SITE_URL, vars.BASE_PATH) }}";

// ci.yml has no upload-artifact to compare against, so this one is a literal pin on purpose: a
// Dependabot bump of it turns this gate red by design and is reviewed by hand (13-RESEARCH).
const UPLOAD_ARTIFACT =
	'uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2';

function count(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

// The `<key>:` input block under workflow_dispatch inputs, up to the next sibling key.
function inputBlock(key: string): string {
	const marker = `\n      ${key}:\n`;
	const start = text.indexOf(marker);
	expect(start, `${key} input missing`).toBeGreaterThan(-1);
	const rest = text.slice(start + marker.length);
	const next = rest.search(/^ {6}[a-z_]+:|^[a-z]/m);
	return rest.slice(0, next === -1 ? undefined : next);
}

// From the trace upload step's name to the end of the file (it is the last step).
function uploadStep(): string {
	const marker = '- name: Upload traces on failure';
	const start = text.indexOf(marker);
	expect(start, 'upload step missing').toBeGreaterThan(-1);
	return text.slice(start);
}

describe('trigger', () => {
	test('the workflow file exists', () => {
		expect(existsSync(SMOKE)).toBe(true);
	});

	test('the workflow is named live-smoke', () => {
		expect(text).toContain('name: live-smoke\n');
	});

	test('runs after every completed ci run on main, plus workflow_dispatch', () => {
		expect(text).toContain(
			'on:\n  workflow_run:\n    workflows: [ci]\n    types: [completed]\n    branches: [main]\n  workflow_dispatch:\n'
		);
	});

	test('dispatch requires base_url and makes expect_version optional', () => {
		expect(inputBlock('base_url')).toContain('required: true');
		expect(inputBlock('expect_version')).toContain('required: false');
	});

	test('no push, pull_request or schedule trigger', () => {
		expect(text).not.toMatch(/^ {2}(push|pull_request|schedule):/m);
	});
});

describe('job gate', () => {
	test('the only PAGES_ENABLED if: line is the exact single-line gate', () => {
		const lines = text.match(/^ +if: .*PAGES_ENABLED.*$/gm) ?? [];
		expect(lines).toEqual([IF]);
	});

	test("vars.PAGES_ENABLED == 'true' appears exactly once", () => {
		expect(count(text, "vars.PAGES_ENABLED == 'true'")).toBe(1);
	});

	test('the workflow_run branch requires a successful push to main', () => {
		expect(IF).toContain("github.event.workflow_run.conclusion == 'success'");
		expect(IF).toContain("github.event.workflow_run.event == 'push'");
		expect(IF).toContain("github.event.workflow_run.head_branch == 'main'");
		expect(text).toContain(`\n${IF}\n`);
	});
});

describe('deployed SHA', () => {
	test('checkout targets the deployed commit, never the default-branch tip', () => {
		expect(text).toContain('ref: ${{ github.event.workflow_run.head_sha || github.sha }}');
		expect(text).not.toMatch(/^ +ref: main$/m);
	});

	test('the expected version is the deployed commit first, dispatch input second', () => {
		expect(text).toContain(
			'SMOKE_EXPECT_VERSION: ${{ github.event.workflow_run.head_sha || inputs.expect_version || github.sha }}'
		);
	});

	test('github.sha is never the only source of the expected version', () => {
		expect(text).not.toMatch(/SMOKE_EXPECT_VERSION: \$\{\{ github\.sha \}\}/);
	});
});

describe('smoke env', () => {
	test('SMOKE_BASE_URL and SMOKE_SITE_URL come from the dispatch input or the Pages variables', () => {
		expect(text).toContain(`SMOKE_BASE_URL: ${DEPLOYED_URL}`);
		expect(text).toContain(`SMOKE_SITE_URL: ${DEPLOYED_URL}`);
	});

	test('SMOKE_ANALYTICS_HOST comes from the analytics variable', () => {
		expect(text).toContain('SMOKE_ANALYTICS_HOST: ${{ vars.PUBLIC_ANALYTICS_HOST }}');
	});

	test('runs the remote smoke exactly once and never the local one', () => {
		expect(count(text, 'run: pnpm smoke\n')).toBe(1);
		expect(text).not.toContain('smoke:local');
	});

	test('installs dependencies from the lockfile and Chromium before the smoke', () => {
		expect(text).toContain('run: pnpm install --frozen-lockfile');
		expect(text).toContain('run: pnpm --filter web exec playwright install --with-deps chromium');
		const install = text.indexOf('run: pnpm install --frozen-lockfile');
		const chromium = text.indexOf('playwright install --with-deps chromium');
		const smoke = text.indexOf('run: pnpm smoke\n');
		expect(install).toBeGreaterThan(-1);
		expect(chromium).toBeGreaterThan(install);
		expect(smoke).toBeGreaterThan(chromium);
	});
});

describe('permissions', () => {
	test('workflow-level permissions are read-only', () => {
		expect(text).toContain('\npermissions:\n  contents: read\n');
	});

	test('no write scope, no OIDC token, no secrets, no pushes', () => {
		expect(text).not.toContain('write');
		expect(text).not.toContain('id-token');
		expect(text).not.toContain('secrets.');
		expect(text).not.toContain('git push');
	});

	test('no gh CLI side effects', () => {
		expect(text).not.toMatch(/gh (api|pr|run|release|repo|variable)/);
	});
});

describe('supply chain', () => {
	const refs = () => [...text.matchAll(/uses: (\S+)@(\S+)/g)];

	test('exactly four uses: lines, each pinned to a 40-hex commit SHA', () => {
		const all = refs();
		expect(all.map((m) => m[1]).sort()).toEqual(
			[
				'actions/checkout',
				'actions/setup-node',
				'actions/upload-artifact',
				'pnpm/action-setup'
			].sort()
		);
		for (const [, action, sha] of all) expect(sha, action).toMatch(/^[0-9a-f]{40}$/);
	});

	test('checkout, pnpm and setup-node pins equal the ones ci.yml carries', () => {
		// Compared with ci.yml, not literals, so a Dependabot PR that bumps every workflow stays green.
		const shared = ['actions/checkout', 'pnpm/action-setup', 'actions/setup-node'];
		for (const action of shared) {
			const ref = refs().find((m) => m[1] === action);
			expect(ref, `${action} missing`).toBeDefined();
			const [, , sha] = ref as RegExpMatchArray;
			expect(ci, `${action}@${sha} not pinned in ci.yml`).toContain(`uses: ${action}@${sha}`);
		}
	});

	test('upload-artifact is the literal v7.0.2 pin (ci.yml has nothing to compare against)', () => {
		expect(count(text, UPLOAD_ARTIFACT)).toBe(1);
		expect(count(text, 'uses: actions/upload-artifact@')).toBe(1);
	});

	test('checkout never persists the token in the working tree', () => {
		expect(count(text, 'uses: actions/checkout@')).toBe(1);
		expect(count(text, 'persist-credentials: false')).toBe(1);
	});

	test('no hard-coded URL or repository host anywhere in the workflow', () => {
		expect(text).not.toContain('https://');
		expect(text).not.toMatch(/tranrealestate|wolfwdavid/i);
	});

	test('ci.yml is untouched by this workflow: still exactly 7 uses: lines', () => {
		expect(count(ci, 'uses: ')).toBe(7);
	});
});

describe('failure evidence', () => {
	test('traces upload only on failure', () => {
		expect(uploadStep()).toContain('if: failure()');
	});

	test('the artifact is the smoke test-results folder, kept 14 days, no-op when empty', () => {
		const step = uploadStep();
		expect(step).toContain('name: live-smoke-traces');
		expect(step).toContain('path: apps/web/test-results/');
		expect(step).toContain('retention-days: 14');
		expect(step).toContain('if-no-files-found: ignore');
	});
});

describe('run hygiene', () => {
	test('smokes are serialized and never cancelled mid-run', () => {
		// A later ci completion must never cancel an in-flight smoke of a real deploy.
		expect(text).toContain('concurrency:\n  group: live-smoke\n  cancel-in-progress: false\n');
	});

	test('the job has a hard timeout and runs on the pinned Ubuntu image', () => {
		expect(text).toContain('timeout-minutes: 25');
		expect(text).toContain('runs-on: ubuntu-24.04');
	});
});

describe('lint coverage', () => {
	test('with no args, actionlint.mjs lints every workflow under .github/workflows', () => {
		expect(actionlint).toContain('readdirSync');
		expect(actionlint).toContain('.github/workflows');
		expect(actionlint).toMatch(/\\.ya\?ml\$/);
		expect(actionlint).not.toContain(": ['.github/workflows/ci.yml']");
	});

	test('an empty workflow list fails closed', () => {
		expect(actionlint).toContain(
			'No workflow files found under .github/workflows; workflow lint blocked.'
		);
	});
});
