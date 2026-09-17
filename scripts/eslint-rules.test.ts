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
