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
	import { db } from '#lib/storage/db.ts';
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

const crossPortalImport = `import { analyze } from '#lib/features/investor/analyzer/index.ts';

export const renterView = () => analyze();
`;

const sharedImport = `import { format } from '#lib/features/shared/format.ts';

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
			`import { getVault } from '#lib/storage/secrets/index.ts';

export const vault = getVault;
`
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toHaveLength(1);
	});
});

// Phase 4: the budget guard holds only if (a) no reactive $effect ever spends a RentCast call and
// (b) nothing outside lib/data reaches past the #lib/data port to the rentcast client, fixtures or
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
		'#lib/data/rentcast/client.ts',
		'#lib/data/fixtures/fixture-fetch.ts',
		'#lib/data/ledger-repo.ts'
	])('a renter route importing %s is rejected', async (spec) => {
		const messages = await lint(`${RENTER_ROUTE}/data-import.ts`, importModule(spec));
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
	});

	test('a renter route importing the #lib/data port is allowed', async () => {
		const messages = await lint(
			`${RENTER_ROUTE}/data-import.ts`,
			importModule('#lib/data/index.ts')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});

	test('features/shared importing #lib/data/gateway is rejected; #lib/data is allowed', async () => {
		const file = `${WEB}/lib/features/shared/data/__lintfix__/c.ts`;
		const bad = await lint(file, importModule('#lib/data/gateway.ts'));
		expectNoParseErrors(bad);
		expect(errorsFor(bad, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
		const good = await lint(file, importModule('#lib/data/index.ts'));
		expect(errorsFor(good, 'no-restricted-imports')).toEqual([]);
	});

	test('inside lib/data the internals may import each other', async () => {
		const messages = await lint(
			`${WEB}/lib/data/__lintfix__/gateway-fixture.ts`,
			`import * as a from './rentcast/client';
import * as b from '#lib/data/rentcast/client.ts';

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
			importModule('#lib/features/investor/x')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
	});
});

// Phase 5 (AI-04): no AI output is ever sent automatically. The lib/ai block uses rule names
// DISTINCT from no-restricted-syntax, because the providers folder turns that rule fully off;
// these cases lint fixtures in lib/ai/providers too, so an override there cannot clobber the ban.
const AI = `${WEB}/lib/ai`;
const PROVIDERS_FIX = `${AI}/providers/__lintfix__`;
const LEADS_MESSAGE = 'AI modules must never import lead delivery';

describe('AI no-auto-send boundary (lintText, in memory)', () => {
	let hasGlobalConfirmBan = false;

	beforeAll(async () => {
		for (const p of [PROVIDERS_FIX, `${AI}/__lintfix__`, `${AI}/ui/__lintfix__`]) {
			expect(existsSync(resolve(repoRoot, p))).toBe(false);
		}
		const probe = await lint(
			`${WEB}/lib/__lintfix__/confirm.ts`,
			`export const ok = confirm('x');\n`
		);
		hasGlobalConfirmBan = errorsFor(probe, 'no-restricted-globals').length > 0;
	});

	test('a lib/ai Svelte component importing #lib/leads/web3forms is rejected', async () => {
		const messages = await lint(
			`${AI}/ui/__lintfix__/panel-fixture.svelte`,
			`<script lang="ts">
	import { send } from '#lib/leads/web3forms.ts';
	const go = () => send();
</script>

<button onclick={go}>Go</button>
`
		);
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-imports');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain(LEADS_MESSAGE);
	});

	test('the providers folder: a relative leads import is rejected and fetch() stays allowed', async () => {
		const messages = await lint(
			`${PROVIDERS_FIX}/adapter-fixture.ts`,
			`import { send } from '../../../leads/web3forms';

export async function relay(): Promise<unknown> {
	const res = await fetch('https://x.test');
	return send(await res.text());
}
`
		);
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-imports');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain(LEADS_MESSAGE);
		expect(errorsFor(messages, 'no-restricted-syntax')).toEqual([]);
	});

	test('the providers folder: navigator.sendBeacon is rejected (override did not clobber it)', async () => {
		const messages = await lint(
			`${PROVIDERS_FIX}/beacon.ts`,
			`export const sent = navigator.sendBeacon('https://x.test', 'a');\n`
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-properties')).toHaveLength(1);
	});

	test.each([
		["window.open('mailto:x')", 'no-restricted-properties'],
		["location.assign('mailto:x')", 'no-restricted-properties'],
		["location.replace('mailto:x')", 'no-restricted-properties'],
		["open('mailto:x')", 'no-restricted-globals'],
		['new XMLHttpRequest()', 'no-restricted-globals'],
		["new WebSocket('wss://x')", 'no-restricted-globals'],
		["new EventSource('/x')", 'no-restricted-globals']
	])('lib/ai: %s is rejected by %s', async (expr, ruleId) => {
		const messages = await lint(`${AI}/__lintfix__/nav.ts`, `export const x = () => ${expr};\n`);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, ruleId)).toHaveLength(1);
	});

	test('lib/ai: navigator.clipboard.writeText (the Copy exit) is allowed', async () => {
		const messages = await lint(
			`${AI}/__lintfix__/exits-fixture.ts`,
			`export async function copy(t: string): Promise<void> {
	await navigator.clipboard.writeText(t);
}
`
		);
		expect(ruleIds(messages)).toEqual([]);
	});

	test('lib/ai keeps the global confirm() and window.confirm() bans', async () => {
		expect(hasGlobalConfirmBan).toBe(true);
		const messages = await lint(
			`${AI}/__lintfix__/confirm.ts`,
			`export const a = confirm('x');\nexport const b = window.confirm('y');\n`
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-globals')).toHaveLength(1);
		expect(errorsFor(messages, 'no-restricted-properties')).toHaveLength(1);
	});

	test('lib/ai keeps the Phase 4 data-port import boundary', async () => {
		const messages = await lint(
			`${AI}/__lintfix__/data-import.ts`,
			importModule('#lib/data/rentcast/client.ts')
		);
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-imports');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain('#lib/data');
	});

	test('control: lib/leads itself is not under the AI block', async () => {
		const messages = await lint(
			`${WEB}/lib/leads/__lintfix__/x.ts`,
			`export async function deliver(): Promise<boolean> {
	await fetch('https://x.test');
	return navigator.sendBeacon('https://x.test', 'a');
}
`
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-properties')).toEqual([]);
		expect(ruleIds(messages)).toEqual([]);
	});
});

// Phase 6: the map libraries live in ONE lazily loaded folder, features/shared never reaches into a
// portal, and the affordability calculator (reused on a Phase 10 marketing page) stays free of
// storage, data and AI.
const svelteImports = (...specs: string[]) =>
	`<script lang="ts">\n${specs.map((s, i) => `\timport * as m${i} from '${s}';`).join('\n')}\n\tconst all = [${specs.map((_, i) => `m${i}`).join(', ')}];\n</script>\n\n<p>{all.length}</p>\n`;

describe('Phase 6 map-library and shared-folder boundaries (lintText, in memory)', () => {
	const MAP = `${WEB}/lib/features/shared/listings/map/ListingMap.svelte`;
	const AFFORD = `${WEB}/lib/features/shared/affordability/AffordabilityCalculator.svelte`;

	test.each([
		[`${WEB}/routes/(marketing)/+page.svelte`, 'leaflet'],
		[`${WEB}/lib/features/renter/search/X.svelte`, 'supercluster'],
		[`${WEB}/routes/(app)/renter/+page.svelte`, 'leaflet/dist/leaflet.css'],
		[`${WEB}/lib/features/shared/listings/PriceHistory.svelte`, 'leaflet'],
		[`${WEB}/lib/storage/__lintfix__/x.ts`, 'leaflet'],
		[`${WEB}/lib/data/__lintfix__/x.ts`, 'supercluster'],
		[`${WEB}/lib/ai/__lintfix__/x.ts`, 'leaflet'],
		[`${WEB}/lib/components/__lintfix__/x.ts`, 'supercluster/dist/index.js']
	])('%s importing %s is rejected', async (file, spec) => {
		const code = file.endsWith('.svelte') ? svelteImports(spec) : importModule(spec);
		const messages = await lint(file, code);
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-imports');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain('listings/map');
	});

	test('the map folder may import leaflet, its CSS and supercluster', async () => {
		const messages = await lint(
			MAP,
			svelteImports('leaflet', 'leaflet/dist/leaflet.css', 'supercluster')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});

	test('the map folder still may not import a portal folder or data internals', async () => {
		const messages = await lint(
			MAP,
			svelteImports('#lib/features/renter/x', '#lib/data/rentcast/client.ts')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toHaveLength(2);
	});

	test('the affordability calculator may not import storage, data or AI', async () => {
		const messages = await lint(
			AFFORD,
			svelteImports('#lib/storage/db.ts', '#lib/data/index.ts', '#lib/ai/runner.ts')
		);
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-imports');
		expect(errors).toHaveLength(3);
		for (const e of errors) expect(e.message).toContain('marketing page');
	});

	test('the affordability calculator may import core math and UI primitives', async () => {
		const messages = await lint(
			AFFORD,
			svelteImports('@tran/core/renter/affordability', '#lib/components/ui/slider/index.ts')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});

	test.each(['renter', 'investor', 'agent'])(
		'the affordability calculator may not import features/%s',
		async (p) => {
			const messages = await lint(AFFORD, svelteImports(`#lib/features/${p}/x`));
			expectNoParseErrors(messages);
			expect(errorsFor(messages, 'no-restricted-imports')).toHaveLength(1);
		}
	);

	test.each(['renter', 'investor', 'agent'])(
		'features/shared/listings may not import features/%s',
		async (p) => {
			const messages = await lint(
				`${WEB}/lib/features/shared/listings/PriceHistory.svelte`,
				svelteImports(`#lib/features/${p}/x`)
			);
			expectNoParseErrors(messages);
			const errors = errorsFor(messages, 'no-restricted-imports');
			expect(errors).toHaveLength(1);
			expect(errors[0].message).toContain('Shared features must not import a portal folder.');
		}
	);

	test('features/shared keeps the Phase 4 data-port boundary', async () => {
		const messages = await lint(
			`${WEB}/lib/features/shared/listings/x.ts`,
			importModule('#lib/data/gateway.ts')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toHaveLength(1);
		const ok = await lint(
			`${WEB}/lib/features/shared/listings/x.ts`,
			importModule('#lib/data/index.ts')
		);
		expect(errorsFor(ok, 'no-restricted-imports')).toEqual([]);
	});

	test('regression: portals keep their cross-portal ban alongside MAP_LIBS', async () => {
		const messages = await lint(
			`${WEB}/lib/features/renter/__lintfix__/x.ts`,
			importModule('#lib/features/investor/x')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toHaveLength(1);
	});

	test('regression: marketing keeps the storage ban alongside MAP_LIBS', async () => {
		const messages = await lint(
			`${WEB}/routes/(marketing)/+page.svelte`,
			svelteImports('#lib/storage/db.ts', 'leaflet')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toHaveLength(2);
	});
});

describe('agent and public boundaries (lintText, in memory)', () => {
	const CRM = `${WEB}/lib/features/agent/crm/__lintfix__/x.ts`;
	const PIPELINE = `${WEB}/routes/(app)/agent/pipeline/__lintfix__/+page.svelte`;
	const STUDIO = `${WEB}/routes/(app)/agent/studio/snapshot/__lintfix__/+page.svelte`;
	const INQUIRE = `${WEB}/routes/(public)/agent/inquire/__lintfix__/+page.svelte`;
	const gatewayErrors = (messages: Message[]) =>
		errorsFor(messages, 'no-restricted-imports').filter((m) =>
			m.message.includes('RentCast gateway')
		);

	test('the agent CRM may not import the RentCast gateway', async () => {
		const messages = await lint(CRM, importModule('#lib/data/rentcast/client.ts'));
		expectNoParseErrors(messages);
		expect(gatewayErrors(messages)).toHaveLength(1);
		const port = await lint(CRM, importModule('#lib/data/index.ts'));
		expectNoParseErrors(port);
		expect(gatewayErrors(port)).toHaveLength(1);
	});

	test('the merged agent entry keeps the cross-portal ban', async () => {
		const messages = await lint(CRM, importModule('#lib/features/renter/thing'));
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-imports');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain('features/agent and features/shared');
	});

	test('agent routes may not import the gateway either', async () => {
		const messages = await lint(PIPELINE, svelteImports('#lib/data/x'));
		expectNoParseErrors(messages);
		expect(gatewayErrors(messages)).toHaveLength(1);
	});

	test('the agent/studio carve-out may use the gateway port but keeps the cross-portal ban', async () => {
		const ok = await lint(STUDIO, svelteImports('#lib/data/index.ts'));
		expectNoParseErrors(ok);
		expect(errorsFor(ok, 'no-restricted-imports')).toEqual([]);
		const internals = await lint(STUDIO, svelteImports('#lib/data/x'));
		expectNoParseErrors(internals);
		expect(gatewayErrors(internals)).toEqual([]);
		const cross = await lint(STUDIO, svelteImports('#lib/features/renter/x'));
		expectNoParseErrors(cross);
		const errors = errorsFor(cross, 'no-restricted-imports');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain('features/studio');
	});

	test.each([
		'#lib/storage/db.ts',
		'#lib/features/agent/ui/StageBadge.svelte',
		'#lib/ai/x',
		'#lib/security/x',
		'#lib/data/index.ts'
	])('the (public) inquiry page may not import %s', async (spec) => {
		const messages = await lint(INQUIRE, svelteImports(spec));
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
	});

	test('the (public) inquiry page may import lib/leads and @tran/core', async () => {
		const messages = await lint(
			INQUIRE,
			svelteImports('#lib/leads/web3forms-sink.ts', '@tran/core/leads/lead-block')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});
});

// Phase 10: the analytics beacon is the only new fetch, and the marketing-safe modules (calculators,
// onboarding, forms, SEO, analytics, content, the shared affordability calculator) stay free of
// storage, AI, data and portal code so marketing routes keep their size budget (RESEARCH Pitfall 9).
describe('Phase 10 boundaries', () => {
	const BEACON = `${WEB}/lib/analytics/beacon.ts`;
	const WAITLIST = `${WEB}/lib/components/forms/WaitlistForm.svelte`;
	const CAP_RATE = `${WEB}/lib/components/tools/CapRateCalculator.svelte`;
	const ONBOARDING = `${WEB}/lib/components/onboarding/onboarding-state.ts`;
	const SEO_HEAD = `${WEB}/lib/seo/SeoHead.svelte`;
	const CONTENT = `${WEB}/lib/content/tools.ts`;
	const AFFORD = `${WEB}/lib/features/shared/affordability/AffordabilityCalculator.svelte`;
	const TOOL_ROUTE = `${WEB}/routes/(marketing)/tools/cap-rate/+page.svelte`;

	test('lib/analytics/beacon.ts may call fetch', async () => {
		const messages = await lint(
			BEACON,
			"export function send(): void {\n\tvoid fetch('https://stats.example.org/api/send', {});\n}\n"
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax')).toEqual([]);
	});

	test('forms may not call fetch directly (they use lib/leads)', async () => {
		const code = `<script lang="ts">\n\tasync function send() {\n\t\tawait fetch('https://x.test');\n\t}\n</script>\n\n<button onclick={send}>Send</button>\n`;
		const messages = await lint(WAITLIST, code);
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-syntax');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain('lib/analytics');
	});

	test.each(['#lib/storage/db.ts', '#lib/features/investor/analyzer/x'])(
		'a tool calculator may not import %s',
		async (spec) => {
			const messages = await lint(CAP_RATE, svelteImports(spec));
			expectNoParseErrors(messages);
			const errors = errorsFor(messages, 'no-restricted-imports');
			expect(errors).toHaveLength(1);
			expect(errors[0].message).toContain('Marketing-safe');
		}
	);

	test('a tool calculator may import @tran/core', async () => {
		const messages = await lint(CAP_RATE, svelteImports('@tran/core'));
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});

	test.each([
		[ONBOARDING, '#lib/data/platform.ts'],
		[SEO_HEAD, '#lib/ai/x'],
		[CONTENT, '#lib/storage/x'],
		[AFFORD, '#lib/data/x']
	])('%s importing %s is rejected', async (file, spec) => {
		const code = file.endsWith('.svelte') ? svelteImports(spec) : importModule(spec);
		const messages = await lint(file, code);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
	});

	test.each([
		['#lib/storage/db.ts', 1],
		['#lib/ai/runner.ts', 1],
		['#lib/data/index.ts', 1],
		['leaflet', 1]
	])('%s is rejected in every marketing-safe folder', async (spec, n) => {
		for (const file of [ONBOARDING, CONTENT, BEACON, `${WEB}/lib/seo/jsonld.ts`]) {
			const messages = await lint(file, importModule(spec));
			expectNoParseErrors(messages);
			expect(errorsFor(messages, 'no-restricted-imports'), file).toHaveLength(n);
		}
	});

	test('forms may import lib/leads (the only send path)', async () => {
		const messages = await lint(WAITLIST, svelteImports('#lib/leads/web3forms-sink.ts'));
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});

	test('a marketing route may not import a portal feature', async () => {
		const messages = await lint(TOOL_ROUTE, svelteImports('#lib/features/renter/x'));
		expectNoParseErrors(messages);
		const errors = errorsFor(messages, 'no-restricted-imports');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain('portal features');
	});

	test('a marketing route may import the shared affordability calculator and tool components', async () => {
		const messages = await lint(
			TOOL_ROUTE,
			svelteImports(
				'#lib/features/shared/affordability/AffordabilityCalculator.svelte',
				'#lib/components/tools/ToolPage.svelte'
			)
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});

	test('regression: portals still import their own features and features/shared', async () => {
		const messages = await lint(
			`${WEB}/routes/(app)/investor/__lintfix__/+page.svelte`,
			svelteImports('#lib/features/investor/x', '#lib/features/shared/affordability/index.ts')
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});
});

// EXT-03: the extension makes no network requests. Every primitive below must be a lint error in
// shipped extension source (apps/extension/src). Virtual paths only; nothing is written to disk.
describe('extension zero-network (EXT-03)', () => {
	const EXT_FIX = 'apps/extension/src/__lintfix__';

	beforeAll(() => {
		expect(existsSync(resolve(repoRoot, EXT_FIX))).toBe(false);
	});

	test.each([
		['fetch', "export const a = fetch('x');\n", 'no-restricted-syntax'],
		['window.fetch', "export const a = window.fetch('x');\n", 'no-restricted-syntax'],
		['sendBeacon', "export const a = navigator.sendBeacon('x', 'y');\n", 'no-restricted-syntax'],
		['XMLHttpRequest', 'export const a = new XMLHttpRequest();\n', 'no-restricted-globals'],
		['WebSocket', "export const a = new WebSocket('wss://x.test');\n", 'no-restricted-globals'],
		['EventSource', "export const a = new EventSource('x');\n", 'no-restricted-globals'],
		[
			'WebTransport',
			"export const a = new WebTransport('https://x.test');\n",
			'no-restricted-globals'
		],
		['importScripts', "importScripts('x');\nexport {};\n", 'no-restricted-globals'],
		['RTCPeerConnection', 'export const a = new RTCPeerConnection();\n', 'no-restricted-globals'],
		[
			'connectNative',
			"declare const browser: any;\nexport const a = browser.runtime.connectNative('x');\n",
			'no-restricted-syntax'
		],
		[
			'sendNativeMessage',
			"declare const chrome: any;\nexport const a = chrome.runtime.sendNativeMessage('x', {});\n",
			'no-restricted-syntax'
		],
		[
			'dynamic import()',
			"export const a = async () => await import('./x');\n",
			'no-restricted-syntax'
		],
		['new Image()', 'export const a = new Image();\n', 'no-restricted-syntax']
	])('%s is a lint error in extension source', async (_name, code, ruleId) => {
		const messages = await lint(`${EXT_FIX}/net-fixture.ts`, code);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, ruleId).length).toBeGreaterThanOrEqual(1);
	});

	test('the network messages name EXT-03', async () => {
		const messages = await lint(
			`${EXT_FIX}/net-fixture.ts`,
			'export const a = new WebSocket("x");\n'
		);
		expect(errorsFor(messages, 'no-restricted-globals')[0].message).toContain('EXT-03');
	});

	test('fetch() inside an extension .svelte component errors', async () => {
		const messages = await lint(`${EXT_FIX}/Popup.svelte`, plainSvelteFetch);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax').length).toBeGreaterThanOrEqual(1);
	});

	test('a .js file in extension source is covered too', async () => {
		const messages = await lint(
			`${EXT_FIX}/net-fixture.js`,
			'export const a = new XMLHttpRequest();\n'
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-globals').length).toBeGreaterThanOrEqual(1);
	});

	test('a clean extension file has zero errors', async () => {
		const messages = await lint(
			`${EXT_FIX}/clean-fixture.ts`,
			"export const a = document.querySelector('#x');\n"
		);
		expect(messages).toEqual([]);
	});

	test('the extension block does not leak into the web app (WebSocket stays legal there)', async () => {
		const messages = await lint(
			`${WEB}/lib/features/shared/__lintfix__/ws.ts`,
			"export const a = new Image();\nexport const b = async () => await import('./x');\n"
		);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-syntax')).toEqual([]);
	});
});

// Kit 3 / Pattern 4: no-restricted-imports groups use gitignore semantics, where a leading "#" starts
// a comment. A group written '#lib/data/*' matches nothing and silently disables the boundary; it must
// be written '\#lib/data/*'. This predicate runs over the EFFECTIVE config, not the source text.
type RestrictedOptions = { patterns?: ({ group?: string[] } | string)[] };
function unescapedHashGroups(options: RestrictedOptions | undefined): string[] {
	const groups = (options?.patterns ?? []).flatMap((p) =>
		typeof p === 'string' ? [p] : (p.group ?? [])
	);
	return groups.filter((g) => g.replace(/^!/, '').startsWith('#'));
}

describe('boundary groups are escaped for gitignore semantics (non-vacuity)', () => {
	const probes = [
		`${WEB}/routes/(marketing)/+page.svelte`,
		`${WEB}/routes/(public)/agent/inquire/+page.svelte`,
		`${WEB}/routes/(app)/renter/+page.svelte`,
		`${WEB}/routes/(app)/investor/+page.svelte`,
		`${WEB}/routes/(app)/agent/+page.svelte`,
		`${WEB}/routes/(app)/agent/studio/snapshot/+page.svelte`,
		`${WEB}/lib/features/shared/x.ts`,
		`${WEB}/lib/features/shared/listings/map/x.ts`,
		`${WEB}/lib/features/shared/affordability/x.ts`,
		`${WEB}/lib/storage/x.ts`,
		`${WEB}/lib/ai/x.ts`,
		`${WEB}/lib/content/x.ts`,
		`${WEB}/lib/seo/x.ts`
	];

	test('planted: an unescaped #lib group is rejected, the escaped one is accepted', () => {
		expect(unescapedHashGroups({ patterns: [{ group: ['#lib/data/*', '#lib/data/**'] }] })).toEqual(
			['#lib/data/*', '#lib/data/**']
		);
		expect(unescapedHashGroups({ patterns: [{ group: ['!#lib/data/tables'] }] })).toEqual([
			'!#lib/data/tables'
		]);
		expect(
			unescapedHashGroups({ patterns: [{ group: ['\\#lib/data/*', '!\\#lib/data/tables'] }] })
		).toEqual([]);
	});

	test('planted: an unescaped group matches nothing, the escaped group reports (the trap is real)', async () => {
		const probe = (group: string) =>
			new ESLint({
				cwd: repoRoot,
				overrideConfigFile: true,
				overrideConfig: [
					{
						files: ['**/*.ts'],
						rules: {
							'no-restricted-imports': ['error', { patterns: [{ group: [group], message: 'm' }] }]
						}
					}
				]
			}).lintText("import * as a from '#lib/data/x.ts';\nexport const b = a;\n", {
				filePath: resolve(repoRoot, `${WEB}/lib/__lintfix__/trap.ts`)
			});
		const bare = (await probe('#lib/data/**')).flatMap((r) => r.messages);
		const escaped = (await probe('\\#lib/data/**')).flatMap((r) => r.messages);
		expect(errorsFor(bare as Message[], 'no-restricted-imports')).toEqual([]);
		expect(errorsFor(escaped as Message[], 'no-restricted-imports')).toHaveLength(1);
	});

	test.each(probes)('effective config for %s has no unescaped #lib group', async (file) => {
		const config = await eslint.calculateConfigForFile(resolve(repoRoot, file));
		const entry = config?.rules?.['no-restricted-imports'] as unknown[] | undefined;
		// Non-vacuity of the probe itself: the rule is configured with patterns for every probed path.
		expect(entry?.length ?? 0).toBeGreaterThan(1);
		expect((entry?.[1] as RestrictedOptions).patterns?.length ?? 0).toBeGreaterThan(0);
		expect(unescapedHashGroups(entry?.[1] as RestrictedOptions)).toEqual([]);
	});

	test('every web boundary names #lib, never the retired $lib alias', async () => {
		const config = await eslint.calculateConfigForFile(
			resolve(repoRoot, `${WEB}/routes/(app)/renter/+page.svelte`)
		);
		const opts = (config?.rules?.['no-restricted-imports'] as unknown[])[1] as RestrictedOptions;
		const groups = (opts.patterns ?? []).flatMap((p) =>
			typeof p === 'string' ? [p] : (p.group ?? [])
		);
		expect(groups.some((g) => g.startsWith('\\#lib/'))).toBe(true);
		expect(groups.some((g) => g.includes(['$', 'lib'].join('')))).toBe(false);
	});
});

// Pitfall 6: Kit 3 resolve() and eslint-plugin-svelte 3.x. The "every internal link goes through
// resolve()" guard must still fire on a bare anchor and stay silent when the link is resolved.
describe('svelte/no-navigation-without-resolve on Kit 3', () => {
	const ROUTE = `${WEB}/routes/(app)/renter/__lintfix__/link-fixture.svelte`;
	const bare = `<a href="/x">x</a>\n`;
	const resolved = `<script lang="ts">\n\timport { resolve } from '$app/paths';\n</script>\n\n<a href={resolve('x/')}>x</a>\n`;

	test('a bare internal anchor is reported', async () => {
		const messages = await lint(ROUTE, bare);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'svelte/no-navigation-without-resolve')).toHaveLength(1);
	});

	test('control: the same link through resolve() is silent', async () => {
		const messages = await lint(ROUTE, resolved);
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'svelte/no-navigation-without-resolve')).toEqual([]);
	});
});

// The storage carve-out: lib/storage/*.ts may import the table schema module and nothing else from
// lib/data (a `!` exemption inside the group, so it too must be written against #lib).
describe('storage table-schema carve-out (lintText, in memory)', () => {
	const DB = `${WEB}/lib/storage/__lintfix__x.ts`;

	test('lib/storage/*.ts may import #lib/data/tables.ts', async () => {
		const messages = await lint(DB, importModule('#lib/data/tables.ts'));
		expectNoParseErrors(messages);
		expect(errorsFor(messages, 'no-restricted-imports')).toEqual([]);
	});

	test.each(['#lib/data/gateway.ts', '#lib/data/ledger-repo.ts', '#lib/data/rentcast/client.ts'])(
		'lib/storage/*.ts importing %s is rejected',
		async (spec) => {
			const messages = await lint(DB, importModule(spec));
			expectNoParseErrors(messages);
			expect(errorsFor(messages, 'no-restricted-imports')).toHaveLength(1);
		}
	);
});
