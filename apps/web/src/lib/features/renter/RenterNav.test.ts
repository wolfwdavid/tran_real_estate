// SSR structural tests for the renter sub-nav (06-04). svelte/server renders the component to a
// string; $app/state is mocked because the Kit plugin is not loaded under Vitest.
import { render } from 'svelte/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ page: { route: { id: '/(app)/renter' as string | null } } }));
vi.mock('$app/state', () => state);

const { default: RenterNav } = await import('./RenterNav.svelte');

const html = (props: Record<string, unknown> = {}) =>
	render(RenterNav, { props }).body.replace(/<!--[\s\S]*?-->/g, '');
const links = (h: string) =>
	[...h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
		attrs: m[1],
		text: m[2].replace(/<[^>]+>/g, '').trim()
	}));

describe('RenterNav', () => {
	beforeEach(() => {
		state.page.route.id = '/(app)/renter';
	});

	test('one Renter tools landmark with Search, Shortlist and Affordability links', () => {
		const h = html();
		expect(h.match(/<nav\b[^>]*aria-label="Renter tools"/g)).toHaveLength(1);
		const ls = links(h);
		expect(ls.map((l) => l.text)).toEqual(['Search', 'Shortlist', 'Affordability']);
		expect(ls.map((l) => /href="([^"]*)"/.exec(l.attrs)?.[1])).toEqual([
			'/renter/',
			'/renter/shortlist/',
			'/renter/affordability/'
		]);
	});

	test.each([
		['/(app)/renter', 'Search'],
		['/(app)/renter/listing', 'Search'],
		['/(app)/renter/shortlist', 'Shortlist'],
		['/(app)/renter/affordability', 'Affordability']
	])('route %s marks only %s as the current page', (id, label) => {
		state.page.route.id = id;
		const current = links(html()).filter((l) => l.attrs.includes('aria-current="page"'));
		expect(current.map((l) => l.text)).toEqual([label]);
	});

	test('no link is current outside the renter routes', () => {
		state.page.route.id = '/(app)/settings';
		expect(html()).not.toContain('aria-current');
	});

	test('a shortlist count renders a badge read as "3 listings"', () => {
		const h = html({ shortlistCount: 3 });
		expect(h).toContain('<span class="sr-only"> listings</span>');
		expect(links(h)[1].text).toBe('Shortlist 3 listings');
	});

	test.each([null, 0])('shortlistCount %s renders no badge', (shortlistCount) => {
		const h = html({ shortlistCount });
		expect(h).not.toContain('sr-only');
		expect(links(h)[1].text).toBe('Shortlist');
	});
});
