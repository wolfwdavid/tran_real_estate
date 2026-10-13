// Supply-chain guards (plan 10-04). The audit exceptions list and pnpm's audit.ignore must not
// drift apart, Dependabot must watch both npm and GitHub Actions, and the lockfile must stay a
// single YAML document (Dependabot reads only the first document of a multi-document pnpm 11
// lockfile and then reports every alert as fixed: RESEARCH Pitfall 12). Files are read as text on
// purpose so no YAML parser joins the dependency graph.
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
});

describe('lockfile', () => {
	test('pnpm-lock.yaml is a single YAML document', () => {
		const lock = read('pnpm-lock.yaml');
		expect(lock).toMatch(/^lockfileVersion:/m);
		expect(lock.split('\n').filter((l) => l.trimEnd() === '---')).toEqual([]);
	});
});
