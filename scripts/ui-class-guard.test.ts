// shadcn UI class guard: pure rules (planted strings + negative controls), CLI non-vacuity against
// throwaway trees under os.tmpdir(), and a pass on the real components/ui tree.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { collectFiles } from './ui-class-guard.mjs';
import { SCANNED_EXT, SCOPE, findUiClassViolations } from './lib/ui-class-rules.mjs';

const REPO_ROOT = join(import.meta.dirname, '..');
const CLI = join(import.meta.dirname, 'ui-class-guard.mjs');
const UI = 'apps/web/src/lib/components/ui';
const FILE = `${UI}/x/x.svelte`;
const BUTTON = `${UI}/button/button.svelte`;

const runCli = (root: string) => {
	const r = spawnSync(process.execPath, [CLI, '--root', root], { encoding: 'utf8' });
	if (r.error) throw r.error;
	return { status: r.status ?? 1, out: r.stdout + r.stderr };
};

const withTree = (files: Record<string, string>, fn: (dir: string) => void) => {
	const dir = mkdtempSync(join(tmpdir(), 'ui-guard-'));
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

const cls = (c: string) => `<div class="flex ${c} p-4"></div>\n`;

describe('findUiClassViolations rules', () => {
	const planted = [
		'bg-secondary',
		'hover:bg-secondary',
		'bg-secondary/80',
		'bg-black/10',
		'bg-black',
		'text-white',
		'dark:bg-x',
		'dark:aria-invalid:ring-destructive/40',
		'ring-ring/50',
		'focus-visible:ring-ring/50',
		'bg-red-500',
		'text-stone-600',
		'border-zinc-200',
		'bg-white',
		'hover:bg-sky-100/50',
		'data-open:animate-in',
		'animate-spin',
		'data-closed:fade-out-0',
		'zoom-in-95',
		'hover:motion-safe:animate-in'
	];
	test.each(planted)('flags planted %s', (c) => {
		const hits = findUiClassViolations(FILE, cls(c));
		expect(hits.length, c).toBeGreaterThan(0);
		expect(hits[0]).toMatch(new RegExp(`^${FILE}:1: .+ \\(matched "`));
	});

	const allowed = [
		'motion-safe:data-open:animate-in',
		'motion-safe:data-closed:zoom-out-98',
		'motion-safe:animate-spin',
		'bg-secondary-surface',
		'text-secondary',
		'border-secondary',
		'bg-foreground/60',
		'text-primary-foreground',
		'text-destructive-foreground',
		'bg-card',
		'focus-visible:outline-ring',
		'has-[>svg]:grid-cols-[20px_1fr]'
	];
	test.each(allowed)('does not flag %s', (c) => {
		expect(findUiClassViolations(FILE, cls(c))).toEqual([]);
	});

	test('a secondary: variant key is flagged in button.svelte only', () => {
		const src = "variant: {\n\tdefault: 'bg-primary',\n\tsecondary:\n\t\t'text-foreground'\n}\n";
		const hits = findUiClassViolations(BUTTON, src);
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatch(/^.+button\.svelte:3: /);
		expect(findUiClassViolations(`${UI}/ButtonLink.svelte`, src)).toEqual([]);
	});

	test("a quoted 'secondary': key is flagged in button.svelte", () => {
		expect(findUiClassViolations(BUTTON, "\t'secondary': 'x',\n")).toHaveLength(1);
	});

	test('reports the right line number', () => {
		const hits = findUiClassViolations(FILE, 'ok\nok\n' + cls('dark:bg-x'));
		expect(hits[0]).toContain(`${FILE}:3:`);
		expect(hits[0]).toContain('matched "dark:bg-x"');
	});
});

describe('scope', () => {
	test('scans components/ui .svelte and .ts', () => {
		expect(SCOPE).toEqual([UI]);
		expect(SCANNED_EXT.test('a.svelte')).toBe(true);
		expect(SCANNED_EXT.test('index.ts')).toBe(true);
		expect(SCANNED_EXT.test('a.css')).toBe(false);
	});

	test('the real tree includes the nine primitives and ButtonLink', () => {
		const files = collectFiles(REPO_ROOT);
		for (const name of [
			'button/button.svelte',
			'input/input.svelte',
			'label/label.svelte',
			'alert-dialog/alert-dialog-content.svelte',
			'dialog/dialog-overlay.svelte',
			'radio-group/radio-group-item.svelte',
			'checkbox/checkbox.svelte',
			'badge/badge.svelte',
			'alert/alert.svelte',
			'ButtonLink.svelte'
		]) {
			expect(files, name).toContain(`${UI}/${name}`);
		}
	});
});

describe('CLI', () => {
	test('fails closed when it scans 0 files', () => {
		withTree({ 'README.md': 'x' }, (dir) => {
			const r = runCli(dir);
			expect(r.status).toBe(1);
			expect(r.out).toContain('0 files');
		});
	});

	test('fails on a planted violation in a nested file', () => {
		withTree(
			{
				[`${UI}/ok/ok.svelte`]: cls('bg-card'),
				[`${UI}/bad/deep/bad.svelte`]: cls('dark:bg-x')
			},
			(dir) => {
				const r = runCli(dir);
				expect(r.status).toBe(1);
				expect(r.out).toContain(`${UI}/bad/deep/bad.svelte:1:`);
			}
		);
	});

	test('passes a clean tree and prints the scanned file count', () => {
		withTree({ [`${UI}/ok/ok.svelte`]: cls('motion-safe:data-open:animate-in') }, (dir) => {
			const r = runCli(dir);
			expect(r.status).toBe(0);
			expect(r.out).toContain('(1 files)');
		});
	});

	test('passes on the real repository tree', () => {
		const r = runCli(REPO_ROOT);
		expect(r.out).toMatch(/UI class guard passed \(\d+ files\)/);
		expect(r.status).toBe(0);
	});
});
