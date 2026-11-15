// TOOL-04: Vitest 5 made vitest-browser-svelte's `render` async. A bare `render(C)` mounts nothing
// in time and the test can pass vacuously, so every call of that import must be awaited.
// Scope: files importing `render` from 'vitest-browser-svelte' only (SSR `render` from
// 'svelte/server' is synchronous and must stay bare). TypeScript AST, not a grep.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

/** 1-based line numbers of calls to the vitest-browser-svelte `render` that are not awaited. */
function bareRenders(path: string, text: string): number[] {
	const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
	const locals = new Set<string>();
	for (const st of sf.statements) {
		if (
			ts.isImportDeclaration(st) &&
			ts.isStringLiteral(st.moduleSpecifier) &&
			st.moduleSpecifier.text === 'vitest-browser-svelte' &&
			st.importClause?.namedBindings &&
			ts.isNamedImports(st.importClause.namedBindings)
		) {
			for (const el of st.importClause.namedBindings.elements) {
				if ((el.propertyName ?? el.name).text === 'render') locals.add(el.name.text);
			}
		}
	}
	const bare: number[] = [];
	const visit = (n: ts.Node) => {
		if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && locals.has(n.expression.text)) {
			if (!ts.isAwaitExpression(n.parent)) {
				bare.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
			}
		}
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return bare;
}

describe('every vitest-browser-svelte render is awaited', () => {
	test('the real tree has no bare render', () => {
		const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
			cwd: ROOT,
			encoding: 'utf8'
		});
		expect(r.status).toBe(0);
		const files = r.stdout
			.split('\0')
			.filter((p) => /\.test\.ts$/.test(p) && !p.startsWith('scripts/vitest5-migration'));
		let scanned = 0;
		const offenders: string[] = [];
		for (const f of files) {
			let text: string;
			try {
				text = read(f);
			} catch {
				continue; // deleted in the working tree
			}
			if (!text.includes('vitest-browser-svelte')) continue;
			scanned++;
			for (const line of bareRenders(f, text)) offenders.push(`${f}:${line}`);
		}
		expect(scanned).toBeGreaterThan(20); // non-vacuity: 37 files import it today
		expect(offenders).toEqual([]);
	});

	const IMP = "import { render } from 'vitest-browser-svelte';\n";
	test('planted: a bare render is reported with its line', () => {
		expect(bareRenders('x.test.ts', `${IMP}it('x', () => {\n\trender(C);\n});`)).toEqual([3]);
	});
	test('planted: an awaited render is not reported', () => {
		expect(bareRenders('x.test.ts', `${IMP}it('x', async () => {\n\tawait render(C);\n});`)).toEqual(
			[]
		);
	});
	test('planted: SSR render from svelte/server is out of scope', () => {
		const src = "import { render } from 'svelte/server';\nit('x', () => {\n\trender(C);\n});";
		expect(bareRenders('x.test.ts', src)).toEqual([]);
	});
	test('planted: a renamed import is tracked by its local name', () => {
		const src = "import { render as r } from 'vitest-browser-svelte';\nit('x', () => {\n\tr(C);\n});";
		expect(bareRenders('x.test.ts', src)).toEqual([3]);
	});
});

describe('Vitest 5 artifacts', () => {
	test('.vitest/ is git-ignored and the old attachment dirs stay', () => {
		const lines = read('.gitignore').split('\n');
		expect(lines).toContain('.vitest/');
		expect(lines).toContain('apps/web/.vitest-attachments/');
		expect(lines).toContain('apps/extension/.vitest-attachments/');
	});
});
