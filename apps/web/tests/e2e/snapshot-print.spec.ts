// Market Snapshot printout E2E (09-18, STU-04; 09-UI-SPEC "Market Snapshot print"). Runs on the
// root and sub projects through the 06-09 no-network harness. Proves, in a real browser and in
// print media: the not-removable labels, the sample marking, the brand prominence rule, that every
// print chart (the 09-08 foreignObject plot) draws a visible, non-zero plot and that no figure or
// table is clipped at the real 672px print width; that the browser PDF stays within its page budget;
// that a saved record prints from this browser's storage with its EHO / Tran footer choices; the
// missing and not-found states; zero RentCast or AI requests; and axe in every state.
import type { Page } from '@playwright/test';
import {
	AI_HOSTS,
	INVESTOR_TEST_OPTIONS,
	collectRequests,
	expect,
	expectNoAxeViolations,
	printCount,
	stubPrint,
	test
} from './investor/helpers';

test.use(INVESTOR_TEST_OPTIONS);

const SHORT_LABEL =
	'Market information only. Not a comparative market analysis or a professional valuation of any property.';
const FULL_LABEL_START =
	'This report summarizes listing-based market statistics from RentCast as of';
const EHO_TITLE = 'Equal Housing Opportunity.';
const TRAN_FOOTER = 'Prepared with Tran Real Estate Tools.';
const SAMPLE_FOOTER = 'Sample data, not a real market.';
const SAMPLE_SENTENCE =
	'Sample data: the ZIP code statistics, listings summary, and agent details in this printout are made up.';
const TITLE_RE = /^Market Snapshot - ZIP \d{5} - \d{4}-\d{2}-\d{2}$/;
/** The printable width of a Letter page with the shared 0.75in margins, in CSS px. */
const PRINT_WIDTH = 672;

/** Pages in the browser's PDF of the full sample report (see the sample test). */
const SAMPLE_PAGE_BUDGET = 6;

/** Page count of Chromium's own PDF of the current page. */
async function pdfPages(page: Page): Promise<number> {
	const pdf = await page.pdf({ preferCSSPageSize: true });
	return Number(/\/Count\s+(\d+)/.exec(pdf.toString('latin1'))?.[1] ?? 0);
}

/** Every scrollable table region on the sheet whose content is wider than the region. */
function clippedRegions(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll('article.print-sheet [role="region"]')]
			.filter((r) => r.scrollWidth > r.clientWidth + 1)
			.map((r) => `${r.getAttribute('aria-label')}: ${r.scrollWidth} > ${r.clientWidth}`)
	);
}

const printButton = (page: Page) => page.getByRole('button', { name: 'Print or save as PDF' });
const sheet = (page: Page) => page.locator('article.print-sheet');

async function openReady(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await expect(page.locator('[data-ready]')).toBeVisible();
	await expect(printButton(page)).toBeEnabled();
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Computed font sizes (px) of the band and Prepared by lines. */
function fontSizes(page: Page) {
	return page.evaluate(() => {
		const px = (sel: string) => {
			const el = document.querySelector(sel);
			return el ? Number.parseFloat(getComputedStyle(el).fontSize) : Number.NaN;
		};
		return {
			bandBrokerage: px('[data-band-brokerage]'),
			bandAgent: px('[data-band-agent]'),
			preparedBrokerage: px('[data-prepared-brokerage]'),
			preparedAgent: px('[data-prepared-agent]'),
			license: px('[data-prepared-license]')
		};
	});
}

async function expectProminence(page: Page, label: string): Promise<void> {
	const s = await fontSizes(page);
	expect(Object.values(s).every(Number.isFinite), `${label}: ${JSON.stringify(s)}`).toBe(true);
	expect(s.bandBrokerage, `${label}: band brokerage font-size`).toBeGreaterThanOrEqual(s.bandAgent);
	expect(s.preparedBrokerage, `${label}: Prepared by brokerage font-size`).toBeGreaterThanOrEqual(
		s.preparedAgent
	);
	expect(s.license, `${label}: license line font-size`).toBeGreaterThanOrEqual(14);
}

interface FigureLayout {
	title: string;
	figure: { scrollWidth: number; clientWidth: number };
	regions: { scrollWidth: number; clientWidth: number }[];
	plot: { width: number; height: number } | null;
	chart: { width: number; height: number; paths: number; visible: boolean } | null;
}

/** Each figure's overflow, its print plot box and the LayerChart SVG drawn inside it. */
function figureLayouts(page: Page): Promise<FigureLayout[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll('article.print-sheet figure')].map((fig) => {
			const box = (el: Element | null) => {
				if (!el) return null;
				const r = el.getBoundingClientRect();
				return { width: r.width, height: r.height };
			};
			const plot = fig.querySelector('[data-print-plot]');
			const inner = plot?.querySelector('foreignObject svg') ?? null;
			const paths = inner
				? [...inner.querySelectorAll('path')].filter(
						(p) => (p.getAttribute('d') ?? '').length > 2 && p.getBBox().width > 0
					).length
				: 0;
			const style = inner ? getComputedStyle(inner) : null;
			const innerBox = box(inner);
			return {
				title: fig.querySelector('h2, h3')?.textContent?.trim() ?? '',
				figure: { scrollWidth: fig.scrollWidth, clientWidth: fig.clientWidth },
				regions: [...fig.querySelectorAll('[role="region"]')].map((r) => ({
					scrollWidth: r.scrollWidth,
					clientWidth: r.clientWidth
				})),
				plot: box(plot),
				chart: innerBox
					? {
							...innerBox,
							paths,
							visible: style?.visibility !== 'hidden' && style?.display !== 'none'
						}
					: null
			};
		})
	);
}

async function expectChartsDrawn(page: Page, label: string): Promise<void> {
	// LayerChart draws after hydration; wait for both plots before measuring.
	await expect
		.poll(
			async () =>
				(await figureLayouts(page)).filter((f) => f.chart !== null && f.chart.paths > 0).length,
			{ message: `${label}: both print plots drawn`, timeout: 15_000 }
		)
		.toBe(2);
	const layouts = await figureLayouts(page);
	expect(layouts.map((f) => f.title)).toEqual([
		'Rent trend by bedroom count',
		'Price-to-rent ratio'
	]);
	for (const f of layouts) {
		const at = `${label}: ${f.title}`;
		expect(f.figure.scrollWidth, `${at} figure overflow`).toBeLessThanOrEqual(
			f.figure.clientWidth + 1
		);
		for (const r of f.regions) {
			expect(r.scrollWidth, `${at} data table overflow`).toBeLessThanOrEqual(r.clientWidth + 1);
		}
		expect(f.plot, `${at} print plot box`).not.toBeNull();
		expect(f.plot!.width, `${at} plot width`).toBeGreaterThan(0);
		expect(f.plot!.height, `${at} plot height`).toBeGreaterThan(0);
		expect(f.chart, `${at} chart svg`).not.toBeNull();
		expect(f.chart!.visible, `${at} chart visible`).toBe(true);
		expect(f.chart!.width, `${at} chart width`).toBeGreaterThan(0);
		expect(f.chart!.height, `${at} chart height`).toBeGreaterThan(0);
		expect(f.chart!.paths, `${at} drawn paths`).toBeGreaterThan(0);
		// The scaled plot fills the figure width instead of a fixed 672px box spilling over it.
		expect(f.plot!.width, `${at} plot fits the figure`).toBeLessThanOrEqual(
			f.figure.clientWidth + 1
		);
	}
}

test('sample report: labels, prominence and charts on screen and in print, a PDF within budget', async ({
	page
}) => {
	test.slow();
	const outbound = collectRequests(page, [...AI_HOSTS, 'api.rentcast.io']);
	await stubPrint(page);
	await openReady(page, 'print/snapshot/?id=sample');

	await expect(page).toHaveTitle(TITLE_RE);
	await expect(printButton(page)).toBeFocused();
	await expect(sheet(page).getByRole('heading', { level: 1 })).toHaveText(
		'Market Snapshot: ZIP 74201'
	);
	await expectProminence(page, 'screen');
	await expectChartsDrawn(page, 'screen');

	// Never prints on load; one click, one print dialog.
	expect(await printCount(page)).toBe(0);
	await printButton(page).click();
	await expect.poll(() => printCount(page)).toBe(1);

	await page.emulateMedia({ media: 'print' });
	await expect(printButton(page)).toBeHidden();
	await expect(page.locator('[data-print-hidden]').first()).toBeHidden();
	const s = sheet(page);
	await expect(s.locator('[data-print-disclaimer-short]')).toHaveText(SHORT_LABEL);
	await expect(s.getByText(SHORT_LABEL, { exact: true })).toBeVisible();
	const important = s.locator('[data-print-important]');
	await expect(important.getByRole('heading', { name: 'Important' })).toBeVisible();
	await expect(important).toContainText(FULL_LABEL_START);
	await expect(important).toContainText('as of Oct 1, 2026');
	await expect(s.getByRole('heading', { name: 'Prepared by', exact: true })).toBeVisible();
	await expect(s.getByRole('heading', { name: 'Data sources', exact: true })).toBeVisible();
	await expect(s.locator('[data-print-sources]')).toContainText('retrieved Oct 1, 2026');
	await expect(s.getByText(EHO_TITLE, { exact: true })).toBeVisible();
	await expect(s.getByText(TRAN_FOOTER, { exact: true })).toBeVisible();
	await expect(s.getByText(SAMPLE_FOOTER, { exact: true })).toBeVisible();
	await expect(s.getByText(SAMPLE_SENTENCE, { exact: true })).toBeVisible();
	await expect(s.locator('[data-provenance-chip="sample"]')).toBeVisible();
	await expect(s.locator('[data-brand-band]')).toBeVisible();
	await expectProminence(page, 'print');
	await expectChartsDrawn(page, 'print');

	// The real print box: a Letter page minus the shared 0.75in margins.
	const viewport = page.viewportSize();
	await page.setViewportSize({ width: PRINT_WIDTH, height: 1000 });
	await expectProminence(page, `print at ${PRINT_WIDTH}px`);
	await expectChartsDrawn(page, `print at ${PRINT_WIDTH}px`);
	const sheetOverflow = await page.evaluate(() => {
		const a = document.querySelector('article.print-sheet') as HTMLElement;
		return a.scrollWidth - a.clientWidth;
	});
	expect(sheetOverflow, 'sheet overflow at print width').toBeLessThanOrEqual(1);
	expect(await clippedRegions(page), 'table regions clipped at print width').toEqual([]);
	if (viewport) await page.setViewportSize(viewport);

	// The browser's own PDF (Chromium). Every section is on and both charts print their 24-month
	// data tables open (UI-SPEC), so the full sample is about 4.7 pages of content at 672 x 912 px
	// per Letter page; the budget is 6. A saved snapshot with fewer sections prints in 1 to 2 pages
	// (test below).
	const pages = await pdfPages(page);
	expect(pages).toBeGreaterThanOrEqual(1);
	expect(pages).toBeLessThanOrEqual(SAMPLE_PAGE_BUDGET);
	await page.emulateMedia({ media: 'screen' });

	expect(await printCount(page)).toBe(1);
	expect(outbound).toEqual([]);
});

test('sample report: axe in screen media', async ({ page }) => {
	test.slow();
	await openReady(page, 'print/snapshot/?id=sample');
	await expectNoAxeViolations(page, 'snapshot print, sample');
});

test('missing id: "Pick a snapshot to print" with a link to the builder', async ({
	page,
	baseURL
}) => {
	const outbound = collectRequests(page, [...AI_HOSTS, 'api.rentcast.io']);
	await page.goto('print/snapshot/');
	const heading = page.getByRole('heading', { name: 'Pick a snapshot to print' });
	await expect(heading).toBeVisible();
	await expect(heading).toBeFocused();
	await expect(page.locator('h1')).toHaveText('Market Snapshot');
	await expect(page.locator('[data-not-found-panel]')).toContainText(
		'Open a saved snapshot from the Studio, or preview the sample report.'
	);
	await expect(page.getByRole('link', { name: 'Go to Market Snapshot' })).toHaveAttribute(
		'href',
		new URL('agent/studio/snapshot/', baseURL).pathname
	);
	await expect(sheet(page)).toHaveCount(0);
	await expectNoAxeViolations(page, 'snapshot print, missing id');
	expect(outbound).toEqual([]);
});

test('unknown id: "We couldn\'t find that snapshot in this browser"', async ({ page }) => {
	const outbound = collectRequests(page, [...AI_HOSTS, 'api.rentcast.io']);
	await page.goto('print/snapshot/?id=nope');
	const heading = page.getByRole('heading', {
		name: "We couldn't find that snapshot in this browser"
	});
	await expect(heading).toBeVisible();
	await expect(heading).toBeFocused();
	await expect(page.locator('h1')).toHaveText('Market Snapshot');
	await expect(
		page.locator('[data-not-found-panel]').getByRole('link', { name: 'Back to Studio' })
	).toBeVisible();
	await expect(sheet(page)).toHaveCount(0);
	await expectNoAxeViolations(page, 'snapshot print, not found');
	expect(outbound).toEqual([]);
});

/** A frozen, non-sample record with EHO and the Tran footer off (synthetic, made-up values). */
function savedRecord(id: string) {
	const at = '2026-09-15T15:00:00.000Z';
	return {
		id,
		zip: '74201',
		placeName: null,
		createdAt: at,
		sample: false,
		source: 'rentcast',
		fetchedAt: at,
		metrics: {
			zip: '74201',
			lastUpdated: '2026-09-14',
			medianRent: 1600,
			medianPrice: 320000,
			priceToRent: 16.7,
			rentChangePct: 2.1,
			rentChangeFrom: '2025-09',
			rentChangeTo: '2026-08',
			months: 12,
			saleDom: 30,
			rentalDom: 20,
			saleTotal: 80,
			saleNew: 15,
			rentalTotal: 110,
			rentalNew: 25,
			rentByBedroom: [
				{ beds: 1, median: 1250, listings: 30 },
				{ beds: 2, median: 1550, listings: 3 }
			]
		},
		series: { rentTrend: null, priceToRent: null },
		listingsSample: null,
		listingsFetchedAt: null,
		narrative: null,
		options: {
			eho: false,
			tranFooter: false,
			sections: ['keyFigures', 'rentByBedroom', 'domInventory']
		},
		agent: {
			disclosure: {
				fullName: 'Jordan Example',
				brokerage: 'Example Homes',
				licenseType: 'Licensed Real Estate Broker',
				licenseNumber: 'EX-1234',
				licenseState: 'OK',
				brokeragePhone: '(555) 555-0142'
			},
			brandPrimary: '#1F4E79',
			brandAccent: '#F6E3D8',
			hasLogo: false
		},
		ownerId: 'local',
		updatedAt: at,
		schemaVersion: 1
	};
}

test('saved record: prints from this browser with EHO and the Tran footer off', async ({
	page
}) => {
	test.slow();
	const outbound = collectRequests(page, [...AI_HOSTS, 'api.rentcast.io']);
	// Opening an unknown id opens the app database at its current version.
	await page.goto('print/snapshot/?id=00000000-0000-4000-8000-000000000000');
	await expect(page.locator('[data-not-found-panel]')).toBeVisible();
	const id = '5d0c2f4e-8a1b-4c3d-9e5f-1a2b3c4d5e6f';
	await page.evaluate(async (row) => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open('tran');
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction('snapshots', 'readwrite');
			tx.objectStore('snapshots').put(row);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	}, savedRecord(id));

	await openReady(page, `print/snapshot/?id=${id}`);
	await expect(page).toHaveTitle('Market Snapshot - ZIP 74201 - 2026-09-15');
	const s = sheet(page);
	// The agent's passing primary colors the h1 (#1F4E79), never a chart or the body text.
	await expect(s.locator('#report-title')).toHaveCSS('color', 'rgb(31, 78, 121)');
	await expect(s.getByText('Prepared Sep 15, 2026 by Jordan Example, Example Homes')).toBeVisible();

	await page.emulateMedia({ media: 'print' });
	await expect(s.getByText(SHORT_LABEL, { exact: true })).toBeVisible();
	await expect(s.locator('[data-print-important]')).toContainText(FULL_LABEL_START);
	await expect(s.getByRole('heading', { name: 'Prepared by', exact: true })).toBeVisible();
	await expect(s.locator('[data-prepared-license]')).toHaveText('License #EX-1234 (OK)');
	await expect(s.getByRole('heading', { name: 'Data sources', exact: true })).toBeVisible();
	await expect(s.getByText(EHO_TITLE, { exact: true })).toHaveCount(0);
	await expect(s.getByText(TRAN_FOOTER, { exact: true })).toHaveCount(0);
	await expect(s.getByText(SAMPLE_FOOTER, { exact: true })).toHaveCount(0);
	await expect(s.locator('[data-provenance-chip="sample"]')).toHaveCount(0);
	await expect(s.getByRole('heading', { name: 'Rent trend by bedroom count' })).toHaveCount(0);
	await expect(s.getByRole('heading', { name: 'Market notes' })).toHaveCount(0);
	await expect(s.getByText('$1,550 (few listings: 3)')).toBeVisible();
	await expectProminence(page, 'saved record, print');
	const viewport = page.viewportSize();
	await page.setViewportSize({ width: PRINT_WIDTH, height: 1000 });
	expect(await clippedRegions(page), 'saved record: regions clipped at print width').toEqual([]);
	if (viewport) await page.setViewportSize(viewport);
	const pages = await pdfPages(page);
	expect(pages).toBeGreaterThanOrEqual(1);
	expect(pages).toBeLessThanOrEqual(2);
	await page.emulateMedia({ media: 'screen' });

	await expectNoAxeViolations(page, 'snapshot print, saved record');
	expect(outbound).toEqual([]);
});
