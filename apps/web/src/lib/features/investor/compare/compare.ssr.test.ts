// SSR tests for CompareTable (07-16, INV-03): real table semantics from 768px, the stacked
// by-metric view below it, and Highest/Lowest markers as icon + word (never color alone).
import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { analyze, buildComparison, COMPARE_ROWS, REFERENCE_CASES } from '@tran/core/finance';
import CompareTable from './CompareTable.svelte';

const clean = (body: string) =>
	body
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\s+/g, ' ')
		.replace(/&#39;|&apos;/g, "'");

const ref = (id: string) => REFERENCE_CASES.find((c) => c.id === id)!;
const cases = ['A', 'D', 'E'].map(ref);
const deals = cases.map((c, i) => ({
	id: `deal-${i}`,
	name: `Deal ${c.id}`,
	address: `${i + 1} Test St`,
	sample: i === 1
}));
const rows = buildComparison(cases.map((c) => ({ inputs: c.inputs, analysis: analyze(c.inputs) })));
const html = clean(render(CompareTable, { props: { deals, rows, onremove: () => {} } }).body);

const CAPTION =
	"Highest or Lowest marks the top figure in each row for that measure, for example the lowest GRM or the highest cash flow. It's arithmetic, not a recommendation.";

function slice(h: string, startMarker: string, endTag: string): string {
	const start = h.indexOf(startMarker);
	expect(start, startMarker).toBeGreaterThan(-1);
	const end = h.indexOf(endTag, start);
	return h.slice(start, end);
}

const tableHtml = slice(html, 'data-compare-view="table"', '</table>');
const stackedHtml = html.slice(html.indexOf('data-compare-view="stacked"'));
const tableRow = (key: string) => slice(tableHtml, `data-row="${key}"`, '</tr>');
const card = (key: string) => slice(stackedHtml, `data-metric-card="${key}"`, '</section>');
const count = (h: string, s: string) => h.split(s).length - 1;

describe('table view (768px and up)', () => {
	test('is the md:block wrapper with a focusable scroll region named by the caption', () => {
		expect(html).toMatch(/class="hidden md:block" data-compare-view="table"/);
		expect(tableHtml).toContain('tabindex="0"');
		expect(tableHtml).toContain(`aria-label="${CAPTION}"`);
		expect(tableHtml).toContain('overflow-x-auto');
	});

	test("caption reads It's arithmetic, not a recommendation.", () => {
		expect(slice(tableHtml, '<caption', '</caption>')).toContain(
			"It's arithmetic, not a recommendation."
		);
	});

	test('three column headers with deal names and remove buttons', () => {
		expect(count(tableHtml, 'scope="col"')).toBe(3);
		for (const d of deals) {
			expect(tableHtml).toContain(d.name);
			expect(tableHtml).toContain(`aria-label="Remove ${d.name} from comparison"`);
		}
		expect(tableHtml).toContain('Sample data');
	});

	test('ten row headers in UI-SPEC order', () => {
		expect(count(tableHtml, 'scope="row"')).toBe(10);
		const labels = [...tableHtml.matchAll(/scope="row"[^>]*>([^<]+)</g)].map((m) => m[1].trim());
		expect(labels).toEqual(COMPARE_ROWS.map((r) => r.label));
	});

	test('GRM tie marks two cells Lowest with the ChevronsDown icon', () => {
		const grm = tableRow('grm');
		expect(count(grm, 'data-marked="true"')).toBe(2);
		expect(count(grm, 'Lowest')).toBe(2);
		expect(grm).toContain('data-icon="chevrons-down"');
		expect(grm).not.toContain('Highest');
		expect(grm).toContain('bg-secondary-surface');
	});

	test('Monthly cash flow marks one cell Highest with ChevronsUp', () => {
		const cf = tableRow('cashFlow');
		expect(count(cf, 'data-marked="true"')).toBe(1);
		expect(count(cf, 'Highest')).toBe(1);
		expect(cf).toContain('data-icon="chevrons-up"');
	});

	test('Purchase price and Monthly rent carry no marker word', () => {
		for (const key of ['price', 'rent']) {
			const r = tableRow(key);
			expect(r).not.toContain('Highest');
			expect(r).not.toContain('Lowest');
			expect(r).not.toContain('data-marked');
		}
	});

	test('Total cash needed is marked Lowest', () => {
		expect(tableRow('cashNeeded')).toContain('Lowest');
		expect(tableRow('cashNeeded')).not.toContain('Highest');
	});
});

describe('stacked view (below 768px)', () => {
	test('md:hidden wrapper with a Deals in this comparison list of remove buttons', () => {
		expect(html).toMatch(/class="grid gap-4 md:hidden" data-compare-view="stacked"/);
		const list = slice(stackedHtml, 'compare-deals-heading', '</section>');
		expect(list).toContain('Deals in this comparison');
		for (const d of deals) {
			expect(list).toContain(`aria-label="Remove ${d.name} from comparison"`);
		}
	});

	test('one section per metric with an h2 and a dl row per deal', () => {
		expect(count(stackedHtml, 'data-metric-card=')).toBe(10);
		for (const def of COMPARE_ROWS) {
			const c = card(def.key);
			expect(c).toMatch(new RegExp(`<h2[^>]*>${def.label.replace(/[()]/g, '\\$&')}</h2>`));
			expect(c).toContain('<dl');
			expect(count(c, '<dt')).toBe(3);
		}
	});

	test('the same marker words as the table', () => {
		expect(count(card('grm'), 'Lowest')).toBe(2);
		expect(count(card('cashFlow'), 'Highest')).toBe(1);
		expect(card('price')).not.toMatch(/Highest|Lowest/);
	});
});

describe('honesty', () => {
	test('the rendered HTML never says best', () => {
		expect(html.toLowerCase()).not.toContain('best');
	});
	test('the component source never says best', () => {
		const src = readFileSync(new URL('./CompareTable.svelte', import.meta.url), 'utf8');
		expect(src.toLowerCase()).not.toContain('best');
	});
});
