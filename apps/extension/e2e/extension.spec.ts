import { existsSync } from 'node:fs';
import path from 'node:path';
import {
	chromium,
	expect,
	test,
	type BrowserContext,
	type Page,
	type Request,
	type Worker
} from '@playwright/test';
import { COPY } from '../src/lib/copy';
import { FIXTURE_C_HTML, PAGE_A, ZILLOW_URL } from './zillow-page';

/**
 * End-to-end proof of the PRODUCTION extension (`wxt build` output, never a -dev build) in
 * Chromium: manifest-injected CSS, the closed-shadow pill, the scoped observer, WXT's
 * wxt:locationchange, storage-driven toggling, real tabs.sendMessage messaging and the badge.
 *
 * The only page is synthetic and is fulfilled from a context route at a zillow.com URL; every
 * other http(s) request is aborted, so the suite never reaches the network. Aborted requests are
 * still emitted as `request` events, so any request the extension made would be recorded and
 * fail the zero-network test at the end.
 */

const EXT_DIR = path.resolve(import.meta.dirname, '../.output/chrome-mv3');
const DIMMED = '[data-tran-slf="dimmed"]';
const ANY_MARK = '[data-tran-slf], [data-tran-slf-pos], tran-slf-pill';

interface Recorded {
	url: string;
	/** Who issued it: a page/frame URL, or `worker:<url>` for a service worker. */
	from: string;
}

/** The slice of the worker-side chrome.* API the badge test calls (no @types/chrome dependency). */
interface WorkerChrome {
	tabs: {
		query(q: { url: string }): Promise<{ id?: number }[]>;
		sendMessage(tabId: number, m: unknown): Promise<unknown>;
	};
	action: { getBadgeText(d: { tabId: number }): Promise<string> };
}

let context: BrowserContext;
let sw: Worker;
let extId: string;
let page: Page;
let mode: 'headless' | 'headed' = 'headless';
const requests: Recorded[] = [];

function origin(r: Request): string {
	const worker = r.serviceWorker();
	if (worker) return `worker:${worker.url()}`;
	try {
		return r.frame().url();
	} catch {
		return 'unknown';
	}
}

async function launch(headless: boolean): Promise<{ ctx: BrowserContext; worker?: Worker }> {
	const ctx = await chromium.launchPersistentContext('', {
		channel: 'chromium',
		headless,
		reducedMotion: 'reduce',
		args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`]
	});
	const worker =
		ctx.serviceWorkers()[0] ??
		(await ctx.waitForEvent('serviceworker', { timeout: 15_000 }).catch(() => undefined));
	return { ctx, worker };
}

/** Recorded http(s) requests that are not the routed synthetic page document. */
function violations(list: readonly Recorded[]): Recorded[] {
	return list.filter((r) => /^https?:/i.test(r.url) && r.url !== ZILLOW_URL);
}

test.describe.serial('production extension in Chromium', () => {
	test.beforeAll(async () => {
		if (!existsSync(path.join(EXT_DIR, 'manifest.json'))) {
			throw new Error(
				`No production build at ${EXT_DIR}. Run corepack pnpm --filter extension build first.`
			);
		}
		if (path.basename(EXT_DIR).endsWith('-dev')) {
			throw new Error(`Refusing to test a dev build (${EXT_DIR}); dev mode adds permissions.`);
		}

		let launched = await launch(true);
		if (!launched.worker && !process.env.CI) {
			// Fallback only off CI; CI runs headless (or under xvfb-run), never skips.
			await launched.ctx.close();
			launched = await launch(false);
			mode = 'headed';
		}
		if (!launched.worker) {
			await launched.ctx.close();
			throw new Error('The extension service worker never started (extension not loaded).');
		}
		context = launched.ctx;
		sw = launched.worker;
		extId = new URL(sw.url()).host;
		console.log(`extension ${extId} loaded (${mode})`);

		context.on('request', (r) => requests.push({ url: r.url(), from: origin(r) }));
		await context.route('**/*', (route) => {
			const url = route.request().url();
			if (url === ZILLOW_URL) {
				return route.fulfill({ status: 200, contentType: 'text/html', body: PAGE_A });
			}
			if (/^https?:/i.test(url)) return route.abort();
			return route.fallback();
		});

		page = context.pages()[0] ?? (await context.newPage());
	});

	test.afterAll(async () => {
		await context?.close();
	});

	test('dims sponsored cards with a reveal pill', async () => {
		await page.goto(ZILLOW_URL);
		await expect(page.locator(DIMMED)).toHaveCount(3);
		for (const id of ['a-1', 'a-2', 'a-7']) {
			await expect(page.locator(`#${id}`)).toHaveAttribute('data-tran-slf', 'dimmed');
			const first = await page
				.locator(`#${id}`)
				.evaluate((el) => el.firstElementChild?.tagName.toLowerCase());
			expect(first).toBe('tran-slf-pill');
		}
		for (const id of ['a-3', 'a-4', 'a-5', 'a-6']) {
			await expect(page.locator(`#${id}`)).not.toHaveAttribute('data-tran-slf');
		}
		await expect(page.locator('#a-1 > article')).toHaveCSS('opacity', '0.35');
		await expect(page.locator('#a-1 > tran-slf-pill[data-tran-slf-pill]')).toHaveCSS(
			'opacity',
			'1'
		);
	});

	test('reveal is one click and does not navigate', async () => {
		const before = page.url();
		// Closed shadow root: Playwright cannot pierce it, so click the host's centre, which lands
		// on the inner button.
		await page.locator('#a-1 > tran-slf-pill').click();
		await expect(page.locator('#a-1')).toHaveAttribute('data-tran-slf', 'revealed');
		await expect(page.locator('#a-1 > article')).toHaveCSS('opacity', '1');
		expect(page.url()).toBe(before);
		await page.locator('#a-1 > tran-slf-pill').click();
		await expect(page.locator('#a-1')).toHaveAttribute('data-tran-slf', 'dimmed');
		expect(page.url()).toBe(before);
	});

	test('late-inserted card is dimmed', async () => {
		await page.evaluate(() => {
			const ul = document.querySelector('#grid-search-results ul');
			if (!ul) throw new Error('results list missing');
			ul.insertAdjacentHTML(
				'beforeend',
				'<li data-c11n-component="List.Item" id="a-8"><article data-testid="property-card"><span>Sponsored</span></article></li>'
			);
		});
		await expect(page.locator('#a-8')).toHaveAttribute('data-tran-slf', 'dimmed', {
			timeout: 2_000
		});
		await expect(page.locator(DIMMED)).toHaveCount(4);
	});

	test('SPA navigation re-acquires the container', async () => {
		const urlBefore = page.url();
		await page.evaluate((html) => {
			const old = document.querySelector('#grid-search-results');
			if (!old) throw new Error('results container missing');
			const tpl = document.createElement('template');
			tpl.innerHTML = html;
			const fresh = tpl.content.firstElementChild;
			if (!fresh) throw new Error('fixture C produced no element');
			old.replaceWith(fresh);
			history.pushState({}, '', '/homes/for_rent/2_p/');
		}, FIXTURE_C_HTML);
		expect(page.url()).not.toBe(urlBefore);
		for (const id of ['c-1', 'c-2', 'c-3']) {
			await expect(page.locator(`#${id}`)).toHaveAttribute('data-tran-slf', 'dimmed', {
				timeout: 3_000
			});
		}
		for (const id of ['c-4', 'c-5']) {
			await expect(page.locator(`#${id}`)).not.toHaveAttribute('data-tran-slf');
		}
		await expect(page.locator(DIMMED)).toHaveCount(3);
	});

	test('content script answers the count message and the badge shows it', async () => {
		const query = () =>
			sw.evaluate(async () => {
				const chrome = (globalThis as unknown as { chrome: WorkerChrome }).chrome;
				const [tab] = await chrome.tabs.query({ url: '*://*.zillow.com/*' });
				if (tab?.id === undefined) return null;
				const res = (await chrome.tabs.sendMessage(tab.id, { type: 'tran-slf:get-count' })) as {
					enabled: boolean;
					count: number;
				};
				const badge = await chrome.action.getBadgeText({ tabId: tab.id });
				return { res, badge };
			});
		// The badge follows the content script's debounced push, so poll until it settles.
		await expect.poll(query, { timeout: 5_000 }).toEqual({
			res: { enabled: true, count: 3 },
			badge: '3'
		});
	});

	test('popup renders under CSP and the toggle restores the page', async () => {
		const popup = await context.newPage();
		const consoleLines: string[] = [];
		popup.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`));
		popup.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`));
		await popup.goto(`chrome-extension://${extId}/popup.html`);

		// The active tab is the popup itself, which the extension cannot read without `tabs`.
		await expect(popup.getByText(COPY.notZillow)).toBeVisible();
		await expect(popup.getByText(COPY.privacyHeading)).toBeVisible();
		await expect(popup.getByText(COPY.notAffiliated)).toBeVisible();

		const toggle = popup.getByRole('switch', { name: COPY.switchLabel });
		await expect(toggle).toBeEnabled();
		await expect(toggle).toBeChecked();

		await toggle.click();
		await expect(toggle).not.toBeChecked();
		await expect(page.locator(ANY_MARK)).toHaveCount(0, { timeout: 2_000 });
		await expect(page.locator('#c-1 > div')).toHaveCSS('opacity', '1');

		await toggle.click();
		await expect(toggle).toBeChecked();
		await expect(page.locator(DIMMED)).toHaveCount(3, { timeout: 2_000 });

		expect(consoleLines.filter((l) => /Content Security Policy/i.test(l))).toEqual([]);
		expect(consoleLines.filter((l) => l.startsWith('error') || l.startsWith('pageerror'))).toEqual(
			[]
		);
		await popup.close();
	});

	test('zero network requests from the extension', async () => {
		const session = [...requests];
		// Sanity: the session actually recorded traffic (the routed document, extension pages).
		expect(session.some((r) => r.url === ZILLOW_URL)).toBe(true);
		expect(session.some((r) => r.url.startsWith(`chrome-extension://${extId}/`))).toBe(true);

		// Every request is either the synthetic document or an extension-internal resource.
		for (const r of session) {
			expect(
				r.url === ZILLOW_URL || r.url.startsWith('chrome-extension://'),
				`${r.url} (from ${r.from})`
			).toBe(true);
		}
		expect(violations(session)).toEqual([]);
		// Nothing issued by the extension's worker or its pages left the extension origin.
		expect(
			session.filter(
				(r) => r.from.includes(`chrome-extension://${extId}/`) && !r.url.startsWith('chrome-')
			)
		).toEqual([]);

		// Planted-violation control: a request from the page frame (where a content script's
		// requests appear) must be recorded and flagged, or the assertions above prove nothing.
		await page.evaluate(() => {
			// eslint-disable-next-line no-restricted-syntax -- deliberate control request (aborted by the route)
			void fetch('https://planted-control.invalid/probe').catch(() => {});
		});
		await expect
			.poll(() => violations(requests).map((r) => r.url), { timeout: 5_000 })
			.toEqual(['https://planted-control.invalid/probe']);

		// Worker-side control: the production CSP (connect-src 'none') rejects a fetch from the
		// service worker before any request exists, so it is refused and never recorded. (Without
		// the CSP the same fetch IS recorded with serviceWorker() set, so the recorder sees workers.)
		const swFetch = await sw.evaluate(() =>
			// eslint-disable-next-line no-restricted-syntax -- deliberate control request (CSP must refuse it)
			fetch('https://planted-control.invalid/worker').then(
				() => 'resolved',
				() => 'rejected'
			)
		);
		expect(swFetch).toBe('rejected');
		expect(violations(requests).map((r) => r.url)).toEqual([
			'https://planted-control.invalid/probe'
		]);
	});
});
