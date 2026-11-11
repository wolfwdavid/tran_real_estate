// Supply-chain guards (plan 10-04). The audit exceptions list and pnpm's audit.ignore must not
// drift apart, Dependabot must watch both npm and GitHub Actions, and the lockfile must keep the
// pnpm 12 shape: exactly two YAML documents, a leading boot document (packageManagerDependencies)
// and the project document last. Dependabot's handling of that shape was fixed upstream on
// 2026-11-03 (dependabot-core #15904); the owner confirms the dependency graph after each push.
// Files are read as text on purpose so no YAML parser joins the dependency graph.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { AUDIT_EXCEPTIONS } from './lib/audit-exceptions.mjs';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const GHSA_LINE = /^\s+-\s+(GHSA-[\w-]+)/;

/** GHSA ids listed under the top-level `audit:` -> `ignore:` key of a pnpm-workspace.yaml. */
function auditIgnoreIds(yaml: string): string[] {
	const lines = yaml.replace(/\r\n/g, '\n').split('\n');
	const start = lines.findIndex((l) => /^audit:\s*$/.test(l));
	if (start === -1) return [];
	const ids: string[] = [];
	let inIgnore = false;
	for (const line of lines.slice(start + 1)) {
		if (/^\S/.test(line)) break; // next top-level key ends the audit block
		if (/^\s+ignore:\s*$/.test(line)) {
			inIgnore = true;
			continue;
		}
		if (/^\s+[\w-]+:/.test(line)) inIgnore = false;
		const m = inIgnore ? GHSA_LINE.exec(line) : null;
		if (m) ids.push(m[1]);
	}
	return ids;
}

/** Splits dependabot.yml `updates:` into one text block per `- package-ecosystem:` entry. */
function dependabotEntries(yaml: string): Map<string, string> {
	const out = new Map<string, string>();
	for (const m of yaml.matchAll(
		/^ {2}- package-ecosystem: ([\w-]+)\n([\s\S]*?)(?=^ {2}- package-ecosystem:|(?![\s\S]))/gm
	)) {
		out.set(m[1], m[2]);
	}
	return out;
}

/**
 * Dependency names under an entry's `ignore:` list whose very next line limits the ignore to
 * `version-update:semver-major`. Any other shape (a bare ignore, a minor/patch ignore) is not
 * returned, so the exact-list assertion below also catches an over-broad ignore.
 */
function majorIgnores(body: string): string[] {
	const lines = body.split('\n');
	const out: string[] = [];
	lines.forEach((line, i) => {
		const m = /^ {6}- dependency-name: '([^']+)'\s*$/.exec(line);
		if (!m) return;
		if (/^ {8}update-types: \['version-update:semver-major'\]\s*$/.test(lines[i + 1] ?? '')) {
			out.push(m[1]);
		}
	});
	return out;
}

// D-06 (plan 13-07): majors of the toolchain set can only land in Phase 16 (pnpm 12 -> Vitest 5 ->
// SvelteKit 3), and @types/node majors follow the Node 24 pin until Phase 14/16 (owner decision B).
const TOOLCHAIN_MAJOR_IGNORES = [
	'@sveltejs/kit',
	'@sveltejs/adapter-static',
	'vitest',
	'@vitest/*',
	'vitest-browser-svelte',
	'pnpm',
	'@types/node'
];

describe('audit exceptions', () => {
	test('the helper extracts GHSA ids from a synthetic audit block (non-vacuity)', () => {
		const yaml = 'audit:\n  ignore:\n    - GHSA-aaaa-bbbb-cccc # reason\nother: 1\n';
		expect(auditIgnoreIds(yaml)).toEqual(['GHSA-aaaa-bbbb-cccc']);
		expect(auditIgnoreIds('packages:\n  - GHSA-not-under-audit\n')).toEqual([]);
	});

	test('pnpm-workspace.yaml audit.ignore equals AUDIT_EXCEPTIONS exactly', () => {
		const ignored = auditIgnoreIds(read('pnpm-workspace.yaml'));
		expect(ignored.length).toBe(new Set(ignored).size);
		expect(new Set(ignored)).toEqual(new Set(AUDIT_EXCEPTIONS.map((e) => e.ghsa)));
		expect(ignored.length).toBe(AUDIT_EXCEPTIONS.length);
	});

	test('every exception records package, path, reason and an ISO revisit date', () => {
		expect(Object.isFrozen(AUDIT_EXCEPTIONS)).toBe(true);
		for (const e of AUDIT_EXCEPTIONS) {
			expect(e.ghsa).toMatch(/^GHSA-[\w-]+$/);
			expect(e.package.trim()).not.toBe('');
			expect(e.path.trim()).not.toBe('');
			expect(e.why.trim()).not.toBe('');
			expect(['low', 'moderate', 'high', 'critical']).toContain(e.severity);
			expect(e.revisitBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(Number.isNaN(Date.parse(e.revisitBy))).toBe(false);
		}
	});

	test('legacy auditConfig keys are not used', () => {
		expect(read('pnpm-workspace.yaml')).not.toMatch(/auditConfig|ignoreGhsas/);
		expect(read('package.json')).not.toMatch(/auditConfig|ignoreGhsas/);
		expect(JSON.parse(read('package.json')).scripts['audit:deps']).toBe(
			'pnpm audit --audit-level low'
		);
	});
});

describe('dependabot', () => {
	const yaml = read('.github/dependabot.yml');
	const entries = dependabotEntries(yaml);

	test('version 2 with npm and github-actions entries', () => {
		expect(yaml).toMatch(/^version: 2$/m);
		expect([...entries.keys()].sort()).toEqual(['github-actions', 'npm']);
	});

	test.each(['npm', 'github-actions'])('%s watches the repo root weekly', (ecosystem) => {
		const body = entries.get(ecosystem) ?? '';
		expect(body).toMatch(/^ {4}directory: \/\s*$/m);
		expect(body).toMatch(/^ {6}interval: weekly\s*$/m);
	});

	test('npm updates are grouped', () => {
		expect(entries.get('npm') ?? '').toMatch(/^ {4}groups:\s*$/m);
	});

	test('the ignore helper reads only semver-major ignores (non-vacuity)', () => {
		const body = [
			'    ignore:',
			"      - dependency-name: 'a'",
			"        update-types: ['version-update:semver-major']",
			"      - dependency-name: 'b'",
			"        update-types: ['version-update:semver-minor']",
			"      - dependency-name: 'c'",
			''
		].join('\n');
		expect(majorIgnores(body)).toEqual(['a']);
		expect(majorIgnores('    groups:\n      g:\n        update-types: [minor, patch]\n')).toEqual(
			[]
		);
	});

	test('npm ignores exactly the toolchain majors of D-06 plus @types/node (decision B)', () => {
		const npm = entries.get('npm') ?? '';
		expect(npm).toMatch(/^ {4}ignore:\s*$/m);
		expect(majorIgnores(npm)).toEqual(TOOLCHAIN_MAJOR_IGNORES);
		// Every ignore entry is a semver-major one: no bare or minor/patch ignore hides in the list.
		expect(npm.match(/^ {6}- dependency-name: /gm)?.length).toBe(TOOLCHAIN_MAJOR_IGNORES.length);
	});

	test('the npm ignore list says why: Phase 16 for the toolchain, Phase 14/16 for @types/node', () => {
		const npm = entries.get('npm') ?? '';
		expect(npm).toMatch(/Phase 16/);
		expect(npm).toMatch(
			/^ {6}# @types\/node majors: owner decision B \(Phase 13\), re-evaluated in Phase 14\/16\.$/m
		);
	});

	test('the weekly minor/patch group stays next to the ignore list', () => {
		const npm = entries.get('npm') ?? '';
		expect(npm).toMatch(/^ {6}npm-minor-patch:\s*$/m);
		expect(npm).toMatch(/^ {8}update-types: \[minor, patch\]\s*$/m);
	});

	test('github-actions has no ignore list', () => {
		expect(entries.get('github-actions') ?? '').not.toMatch(/ignore:/);
	});
});

/**
 * Split a multi-document YAML text on `---` lines (a leading marker opens the first document and
 * produces no empty document). Text-only on purpose: no YAML parser joins the dependency graph.
 */
function lockDocuments(lock: string): string[] {
	return lock
		.split('\n')
		.reduce<string[][]>(
			(docs, line) => {
				if (line.trimEnd() === '---') docs.push([]);
				else docs[docs.length - 1].push(line);
				return docs;
			},
			[[]]
		)
		.map((d) => d.join('\n'))
		.filter((d) => d.trim() !== '');
}

/** The shape rules: exactly two documents, boot first, project importers last. */
function lockfileProblems(lock: string): string[] {
	const docs = lockDocuments(lock);
	if (docs.length !== 2) return [`expected exactly 2 YAML documents, found ${docs.length}`];
	const [boot, project] = docs;
	const problems: string[] = [];
	if (!/^packageManagerDependencies:|^ {4}packageManagerDependencies:/m.test(boot))
		problems.push('first document lacks packageManagerDependencies');
	for (const doc of docs)
		if (!/^lockfileVersion:/m.test(doc)) problems.push('a document lacks lockfileVersion');
	if (!/^importers:/m.test(project)) problems.push('last document lacks importers');
	for (const importer of ['apps/web', 'apps/extension'])
		if (!new RegExp(`^ {2}${importer}:\\s*$`, 'm').test(project))
			problems.push(`last document lacks the ${importer} importer`);
	if (!/^ {2}packages\/[\w-]+:\s*$/m.test(project))
		problems.push('last document lacks a packages/ importer');
	return problems;
}

describe('lockfile', () => {
	test('pnpm-lock.yaml is the pnpm 12 two-document lockfile with the project document last', () => {
		expect(lockfileProblems(read('pnpm-lock.yaml'))).toEqual([]);
	});

	test('the first document is the boot document and holds the pinned pnpm', () => {
		const pm = (JSON.parse(read('package.json')).packageManager as string).replace(/^pnpm@/, '');
		const [boot] = lockDocuments(read('pnpm-lock.yaml'));
		expect(boot).toContain(`specifier: ${pm}`);
		expect(boot).toContain(`version: ${pm}`);
	});

	test('non-vacuity: a third document is rejected', () => {
		const lock = read('pnpm-lock.yaml');
		expect(lockfileProblems(lock + "\n---\nlockfileVersion: '9.0'\n")).toEqual([
			'expected exactly 2 YAML documents, found 3'
		]);
	});

	test('non-vacuity: a single document and a last document without the web importer are rejected', () => {
		const [boot, project] = lockDocuments(read('pnpm-lock.yaml'));
		expect(lockfileProblems(project)).toEqual(['expected exactly 2 YAML documents, found 1']);
		const noWeb = project.replace(/^ {2}apps\/web:\s*$/m, '  apps/not-web:');
		expect(lockfileProblems(`---\n${boot}\n---\n${noWeb}`)).toContain(
			'last document lacks the apps/web importer'
		);
		expect(lockfileProblems(`---\n${project}\n---\n${boot}`)).toContain(
			'first document lacks packageManagerDependencies'
		);
	});
});
