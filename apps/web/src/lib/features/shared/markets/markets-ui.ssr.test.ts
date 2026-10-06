// SSR structure for the markets UI (07-13): WatchZipForm and ZipCard. The live behaviour (cost
// labels, call counts, focus, announcements) is proven by tests/e2e/investor/markets.spec.ts.
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test, vi } from 'vitest';
import type { MarketResult, MarketsPort } from './markets-port';
import WatchZipForm from './WatchZipForm.svelte';
import ZipCard from './ZipCard.svelte';

const strip = (h: string) =>
	h
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (c: Component<any>, props: Record<string, unknown>) =>
	render(c, { props }).body.replace(/<!--[\s\S]*?-->/g, '');

function spyPort() {
	return {
		estimateCost: vi.fn(),
		peek: vi.fn(),
		load: vi.fn()
	} as unknown as MarketsPort & Record<'estimateCost' | 'peek' | 'load', ReturnType<typeof vi.fn>>;
}

const RESULT: MarketResult = {
	stats: {
		zipCode: '79999',
		rentalData: { medianRent: 1620, totalListings: 42, lastUpdatedDate: '2026-10-01', history: {} },
		saleData: { medianPrice: 289000, totalListings: 18, lastUpdatedDate: '2026-10-01', history: {} }
	},
	provenance: { source: 'sample' }
} as unknown as MarketResult;

describe('WatchZipForm (SSR)', () => {
	test('labelled numeric ZIP input and the Watch ZIP button; nothing read or spent', () => {
		const port = spyPort();
		const out = html(WatchZipForm, { port, watched: [], onWatched: () => {} });
		const label = out.match(/<label[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/label>/);
		expect(label?.[2].trim()).toBe('ZIP code');
		const input = out.match(new RegExp(`<input[^>]*id="${label?.[1]}"[^>]*>`))?.[0] ?? '';
		expect(input).toContain('inputmode="numeric"');
		expect(input).toContain('maxlength="5"');
		expect(input).toContain('autocomplete="postal-code"');
		const button = out.match(/<button[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? '';
		expect(strip(button)).toBe('Watch ZIP');
		expect(port.estimateCost).not.toHaveBeenCalled();
		expect(port.peek).not.toHaveBeenCalled();
		expect(port.load).not.toHaveBeenCalled();
	});
});

describe('ZipCard (SSR)', () => {
	test('heading, current figures, dashboard link and Stop watching', () => {
		const out = html(ZipCard, {
			zip: '79999',
			result: RESULT,
			headingId: 'zip-79999',
			onStop: () => {}
		});
		expect(out).toMatch(/<h2[^>]*id="zip-79999"[^>]*>\s*ZIP 79999\s*<\/h2>/);
		const dl = out.match(/<dl[^>]*>([\s\S]*?)<\/dl>/)?.[1] ?? '';
		const terms = [...dl.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>/g)].map((m) => strip(m[1]));
		const values = [...dl.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => strip(m[1]));
		expect(terms).toEqual(['Median rent', 'Median sale price', 'Price-to-rent ratio']);
		expect(values).toEqual(['$1,620', '$289,000', '14.9']);
		const link = out.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
		expect(strip(link?.[2] ?? '')).toBe('Open dashboard');
		expect(link?.[1].replace(/&amp;/g, '&')).toMatch(/\/investor\/market\/\?zip=79999$/);
		expect(strip(out)).toContain('Stop watching');
		// Sample provenance: the chip, never a Refresh (1 call).
		expect(strip(out)).not.toContain('Refresh');
	});

	test('no saved data yet: dashes, never $0', () => {
		const out = strip(html(ZipCard, { zip: '79999', headingId: 'z', onStop: () => {} }));
		expect(out).toContain('Median rent — Median sale price — Price-to-rent ratio —');
		expect(out).not.toContain('$0');
	});
});
