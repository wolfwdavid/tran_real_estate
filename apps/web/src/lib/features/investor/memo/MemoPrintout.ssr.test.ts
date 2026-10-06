// MemoPrintout on screen (07-20 sweep finding): at 375px with the WCAG 1.4.12 text-spacing
// overrides the input tables were wider than the sheet and scrolled the whole page sideways. Each
// table now sits in its own focusable, named scroll region that is plain flow on paper.
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import MemoPrintout from './MemoPrintout.svelte';

const html = render(MemoPrintout, {
	props: {
		memoText: 'Monthly cash flow is $184.',
		figures: [{ metric: 'Monthly cash flow', figure: '$184', meaning: 'Left after costs.' }],
		tables: {
			purchase: [{ item: 'Purchase price', amount: '$240,000', source: 'Sample data' }],
			income: [{ item: 'Monthly rent', amount: '$2,100', source: 'Sample data' }],
			expenses: [
				{ name: 'Property tax', enteredAs: '1.2% of price', monthly: '$240', source: 'You' }
			],
			expensesTotal: '$240'
		}
	}
}).body;

/** Every opening <div ...> tag that is a region. */
const regions = [...html.matchAll(/<div\b[^>]*role="region"[^>]*>/g)].map((m) => m[0]);

describe('MemoPrintout scroll regions', () => {
	it('wraps each of the four tables in exactly one region', () => {
		expect((html.match(/<table\b/g) ?? []).length).toBe(4);
		expect(regions).toHaveLength(4);
	});

	it('regions scroll sideways on screen only, are focusable and named', () => {
		for (const tag of regions) {
			expect(tag).toContain('tabindex="0"');
			expect(tag).toMatch(/overflow-x-auto/);
			expect(tag).toMatch(/print:overflow-visible/);
			expect(tag).toMatch(/aria-label(ledby)?="[^"]+"/);
		}
		expect(regions[0]).toContain('aria-labelledby="report-figures"');
		expect(regions.slice(1).map((t) => t.match(/aria-label="([^"]+)"/)?.[1])).toEqual([
			'Purchase and financing',
			'Income',
			'Operating expenses'
		]);
	});
});
