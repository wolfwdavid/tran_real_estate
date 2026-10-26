import { fixtureA, fixtureC } from '../tests/fixtures/cards';

/**
 * Synthetic results page for the extension E2E suite. The URL only has to match the content
 * script's `*://*.zillow.com/*` pattern: the spec fulfils it from a route, so the real site is
 * never contacted. The markup is the hand-written fixtures (no scripts, no links, no URLs).
 */
export const ZILLOW_URL = 'https://www.zillow.com/homes/for_rent/';

export function zillowPage(body: string): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Synthetic results</title></head><body>${body}</body></html>`;
}

export const PAGE_A = zillowPage(fixtureA.html);
export const FIXTURE_C_HTML = fixtureC.html;
