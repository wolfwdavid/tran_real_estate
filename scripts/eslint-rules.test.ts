// Proves the architectural boundaries in eslint.config.js fire on violations and stay silent on
// their allowlists. Every fixture is linted IN MEMORY via lintText with a virtual filePath: nothing
// is ever written into apps/web/src, and the sanitizer path below must never exist on disk.
import { ESLint } from 'eslint';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..');
const WEB = 'apps/web/src';

const eslint = new ESLint({
	cwd: repoRoot,
	// Only the type-aware plumbing is neutralised, never a rule: eslint.config.js enables
	// parserOptions.projectService for **/*.svelte, and the TS project service cannot resolve a
	// file that does not exist on disk. None of the rules under test need type information.
	overrideConfig: [
		{
			files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
			languageOptions: { parserOptions: { projectService: false, project: null } }
		}
	]
});

type Message = { ruleId: string | null; message: string; line: number };

async function lint(filePath: string, code: string): Promise<Message[]> {
	const results = await eslint.lintText(code, {
		filePath: resolve(repoRoot, filePath),
		warnIgnored: false
	});
	return results.flatMap((r) =>
		r.messages.map((m) => ({ ruleId: m.ruleId, message: m.message, line: m.line }))
	);
}

const ruleIds = (messages: Message[]) => messages.map((m) => m.ruleId);
const errorsFor = (messages: Message[], ruleId: string) =>
	messages.filter((m) => m.ruleId === ruleId);

// A parse error surfaces as ruleId === null; that would mean a broken fixture, not a broken rule.
const expectNoParseErrors = (messages: Message[]) => {
	expect(messages.filter((m) => m.ruleId === null)).toEqual([]);
};

const marketingViolations = `<script lang="ts">
	import { db } from '$lib/storage/db';
	let value = $state('<b>hi</b>');
	async function load() {
		await fetch('https://x.test');
		await window.fetch('https://x.test');
		return db;
	}
</script>

<button onclick={load}>Load</button>
<div>{@html value}</div>
`;

const adapterFetch = `export async function listListings(apiKey: string): Promise<unknown> {
	const res = await fetch('https://api.rentcast.io/v1/listings', { headers: { 'X-Api-Key': apiKey } });
	return res.json();
}
`;

const crossPortalImport = `import { analyze } from '$lib/features/investor/analyzer';

export const renterView = () => analyze();
`;

const sharedImport = `import { format } from '$lib/features/shared/format';

export const renterView = () => format();
`;

const sanitizerModule = `<script lang="ts">
	let { html }: { html: string } = $props();
</script>

<div>{@html html}</div>
`;

const plainSvelteFetch = `<script lang="ts">
	async function ping() {
		await fetch('https://x.test');
	}
</script>

<button onclick={ping}>Ping</button>
`;

describe('eslint architectural boundaries (lintText, in memory)', () => {
	beforeAll(() => {
		// The allowlist keys off this exact production path; it must stay virtual.
		expect(existsSync(resolve(repoRoot, `${WEB}/lib/security/sanitize-html.svelte`))).toBe(false);
		expect(existsSync(resolve(repoRoot, `${WEB}/routes/(marketing)/__lintfix__`))).toBe(false);
	});

	test('marketing route: storage import, fetch(), window.fetch() and {@html} all fire', async () => {
		const messages = await lint(
			`${WEB}/routes/(marketing)/__lintfix__/page-fixture.svelte`,
			marketingViolations
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toHaveLength(1);
		expect(errorsFor(messages, 'no-restricted-syntax')).toHaveLength(2);
		expect(errorsFor(messages, 'svelte/no-at-html-tags')).toHaveLength(1);
		expect(messages.length).toBeGreaterThanOrEqual(4);
	});

	test('marketing import ban names the storage module on the import line', async () => {
		const messages = await lint(
			`${WEB}/routes/(marketing)/__lintfix__/page-fixture.svelte`,
			marketingViolations
		);
		const [importError] = errorsFor(messages, 'no-restricted-imports');
		expect(importError.line).toBe(2);
	});

	test('fetch ban fires in an ordinary Svelte component outside the adapter folders', async () => {
		const messages = await lint(
			`${WEB}/routes/(app)/renter/__lintfix__/component-fixture.svelte`,
			plainSvelteFetch
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax')).toHaveLength(1);
	});

	test('rentcast adapter folder: fetch() is allowed', async () => {
		const messages = await lint(
			`${WEB}/lib/data/rentcast/__lintfix__/adapter-fixture.ts`,
			adapterFetch
		);
		expect(ruleIds(messages)).toEqual([]);
	});

	test.each([`${WEB}/lib/ai/providers`, `${WEB}/lib/leads`])(
		'adapter folder %s: fetch() is allowed',
		async (folder) => {
			const messages = await lint(`${folder}/__lintfix__/adapter-fixture.ts`, adapterFetch);
			expect(ruleIds(messages)).toEqual([]);
		}
	);

	test('renter feature importing the investor feature is rejected', async () => {
		const messages = await lint(
			`${WEB}/lib/features/renter/__lintfix__/cross-import.ts`,
			crossPortalImport
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
	});

	test('renter portal route importing the agent feature is rejected', async () => {
		const messages = await lint(
			`${WEB}/routes/(app)/renter/__lintfix__/cross-import.ts`,
			crossPortalImport.replace('investor/analyzer', 'agent/crm')
		);
		expect(errorsFor(messages, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
	});

	test('renter feature importing features/shared is allowed', async () => {
		const messages = await lint(
			`${WEB}/lib/features/renter/__lintfix__/shared-import.ts`,
			sharedImport
		);
		expect(ruleIds(messages)).toEqual([]);
	});

	test('sanitizer module is the only place {@html} is allowed', async () => {
		const messages = await lint(`${WEB}/lib/security/sanitize-html.svelte`, sanitizerModule);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'svelte/no-at-html-tags')).toEqual([]);
		expect(ruleIds(messages)).toEqual([]);
	});

	test('the same {@html} outside the sanitizer module is rejected', async () => {
		const messages = await lint(
			`${WEB}/lib/security/__lintfix__/not-the-sanitizer.svelte`,
			sanitizerModule
		);
		expect(errorsFor(messages, 'svelte/no-at-html-tags')).toHaveLength(1);
	});

	test('no virtual fixture path is matched by the ignores list', async () => {
		// If a path were ignored, lintText would return zero messages for a violating file; the
		// violating cases above already prove otherwise, and this checks it explicitly.
		const paths = [
			`${WEB}/routes/(marketing)/__lintfix__/page-fixture.svelte`,
			`${WEB}/lib/features/renter/__lintfix__/cross-import.ts`
		];
		for (const p of paths) {
			expect(await eslint.isPathIgnored(resolve(repoRoot, p))).toBe(false);
		}
	});
});

const serviceWorkerFetch = `/// <reference lib="webworker" />
const sw = self as unknown as ServiceWorkerGlobalScope;
sw.addEventListener('fetch', (event) => {
	const req = event.request;
	event.respondWith(fetch(req));
});
`;

const siblingFetch = `export async function probe(): Promise<Response> {
	return fetch('https://x.test');
}
`;

const consoleLeak = `export function save(key: string): void {
	console.log(key);
}
`;

const VAULT_PROBE = `${WEB}/lib/storage/secrets/__lint-probe__.ts`;

describe('Phase 3 guardrails', () => {
	beforeAll(() => {
		// Fixtures are linted virtually. The vault probe uses a reserved name that no real module may take,
		// so it coexists with the real secrets/vault.ts while still exercising the folder-wide rule.
		expect(existsSync(resolve(repoRoot, VAULT_PROBE))).toBe(false);
		expect(existsSync(resolve(repoRoot, `${WEB}/lib/pwa/install.ts`))).toBe(false);
	});

	test('the service worker may call fetch()', async () => {
		const messages = await lint(`${WEB}/service-worker.ts`, serviceWorkerFetch);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax')).toEqual([]);
	});

	test('a sibling of the service worker is still under the fetch ban', async () => {
		const messages = await lint(`${WEB}/lib/pwa/install.ts`, siblingFetch);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax')).toHaveLength(1);
	});

	test('bare confirm() is rejected and points at ConfirmDialog', async () => {
		const messages = await lint(
			`${WEB}/routes/(app)/settings/+page.svelte`,
			`<script lang="ts">
	function forget() {
		if (confirm('x')) return true;
		return false;
	}
</script>

<button onclick={forget}>Forget</button>
`
		);
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-globals');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain('ConfirmDialog');
	});

	test('window.confirm() is rejected', async () => {
		const messages = await lint(
			`${WEB}/lib/features/shared/settings/X.svelte`,
			`<script lang="ts">
	function forget() {
		return window.confirm('x');
	}
</script>

<button onclick={forget}>Forget</button>
`
		);
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-properties');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain('ConfirmDialog');
	});

	test('console.* is an error inside the key vault folder', async () => {
		const messages = await lint(VAULT_PROBE, consoleLeak);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-console')).toHaveLength(1);
	});

	test('control: the same console call elsewhere in storage is not a no-console error', async () => {
		const messages = await lint(`${WEB}/lib/storage/db.ts`, consoleLeak);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-console')).toEqual([]);
	});

	test('a marketing page importing the key vault is rejected', async () => {
		const messages = await lint(
			`${WEB}/routes/(marketing)/__lintfix__/vault-import.ts`,
			`import { getVault } from '$lib/storage/secrets';

export const vault = getVault;
`
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toHaveLength(1);
	});
});

// Phase 4: the budget guard holds only if (a) no reactive $effect ever spends a RentCast call and
// (b) nothing outside lib/data reaches past the $lib/data port to the rentcast client, fixtures or
// internal repos. Both live in shared arrays because flat config REPLACES rule options (Pitfall 6).
const RENTER_ROUTE = `${WEB}/routes/(app)/renter/__lintfix__`;
const EFFECT_MESSAGE = 'Never spend RentCast calls from $effect';

const effectSvelte = (body: string) => `<script lang="ts">
	declare const gateway: { get(r: unknown): unknown; peek(r: unknown): unknown; rentalListingById(id: string): Promise<unknown> };
	declare const dataGateway: { refresh(r: unknown): Promise<unknown> };
	const req = {};
	const id = 'x';
	${body}
</script>

<p>fixture</p>
`;

const importModule = (spec: string) => `import * as mod from '${spec}';

export const used = mod;
`;

describe('Phase 4 data-layer boundaries (lintText, in memory)', () => {
	beforeAll(() => {
		expect(existsSync(resolve(repoRoot, RENTER_ROUTE))).toBe(false);
		expect(existsSync(resolve(repoRoot, `${WEB}/lib/data/__lintfix__`))).toBe(false);
		expect(existsSync(resolve(repoRoot, `${WEB}/lib/features/shared/data/__lintfix__`))).toBe(
			false
		);
		expect(existsSync(resolve(repoRoot, `${WEB}/lib/features/shared/__lintfix__`))).toBe(false);
	});

	test('$effect(() => { gateway.get(req) }) is rejected with the spend message', async () => {
		const messages = await lint(
			`${RENTER_ROUTE}/effect-spend.svelte`,
			effectSvelte('$effect(() => { gateway.get(req); });')
		);
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-syntax');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain(EFFECT_MESSAGE);
	});

	test('$effect.pre(() => { scheduler.runDueSearches() }) in a .svelte.ts module is rejected', async () => {
		const messages = await lint(
			`${WEB}/lib/features/shared/__lintfix__/x.svelte.ts`,
			`declare const scheduler: { runDueSearches(): Promise<void> };
$effect.pre(() => {
	void scheduler.runDueSearches();
});
`
		);
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-syntax');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain(EFFECT_MESSAGE);
	});

	test('object names ending in gateway match case-insensitively (dataGateway.refresh)', async () => {
		const messages = await lint(
			`${RENTER_ROUTE}/effect-refresh.svelte`,
			effectSvelte('$effect(() => { void dataGateway.refresh(req); });')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax')).toHaveLength(1);
	});

	test('gateway.rentalListingById inside $effect is rejected', async () => {
		const messages = await lint(
			`${RENTER_ROUTE}/effect-by-id.svelte`,
			effectSvelte('$effect(() => { void gateway.rentalListingById(id); });')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax')).toHaveLength(1);
	});

	test('a spend in an event handler is allowed', async () => {
		const messages = await lint(
			`${RENTER_ROUTE}/handler-spend.svelte`,
			effectSvelte('').replace(
				'<p>fixture</p>',
				'<button onclick={() => gateway.get(req)}>Search</button>'
			)
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax')).toEqual([]);
	});

	test('gateway.peek inside $effect is allowed (peek never spends)', async () => {
		const messages = await lint(
			`${RENTER_ROUTE}/effect-peek.svelte`,
			effectSvelte('$effect(() => { void gateway.peek(req); });')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax')).toEqual([]);
	});

	test.each([
		'$lib/data/rentcast/client',
		'$lib/data/fixtures/fixture-fetch',
		'$lib/data/ledger-repo'
	])('a renter route importing %s is rejected', async (spec) => {
		const messages = await lint(`${RENTER_ROUTE}/data-import.ts`, importModule(spec));
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
	});

	test('a renter route importing the $lib/data port is allowed', async () => {
		const messages = await lint(`${RENTER_ROUTE}/data-import.ts`, importModule('$lib/data'));
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});

	test('features/shared importing $lib/data/gateway is rejected; $lib/data is allowed', async () => {
		const file = `${WEB}/lib/features/shared/data/__lintfix__/c.ts`;
		const bad = await lint(file, importModule('$lib/data/gateway'));
		expectNoParseErrors(bad);
		expect(errorsFor(bad, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
		const good = await lint(file, importModule('$lib/data'));
		expect(errorsFor(good, 'no-restricted-imports')).toEqual([]);
	});

	test('inside lib/data the internals may import each other', async () => {
		const messages = await lint(
			`${WEB}/lib/data/__lintfix__/gateway-fixture.ts`,
			`import * as a from './rentcast/client';
import * as b from '$lib/data/rentcast/client';

export const used = [a, b];
`
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});

	test('regression: $effect spend and fetch both fire in one renter route', async () => {
		const messages = await lint(
			`${RENTER_ROUTE}/both.svelte`,
			effectSvelte(`$effect(() => { gateway.get(req); });
	async function ping() {
		await fetch('https://x.test');
	}
	void ping;`)
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax')).toHaveLength(2);
	});

	test('regression: the portal import boundary still fires alongside the data-port pattern', async () => {
		const messages = await lint(
			`${RENTER_ROUTE}/cross-import.ts`,
			importModule('$lib/features/investor/x')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
	});
});
