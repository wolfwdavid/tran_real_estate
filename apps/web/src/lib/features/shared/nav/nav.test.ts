// Shared portal sub-navigation (07-03): the pure current-item rule and the SSR structure of
// PortalSubNav. $app/state is mocked because the Kit plugin is not loaded under Vitest.
import { render } from 'svelte/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { currentItemIndex, routeIdToPath, type SubNavItem } from './nav';

const state = vi.hoisted(() => ({ page: { route: { id: '/(app)/investor' as string | null } } }));
vi.mock('$app/state', () => state);

const { default: PortalSubNav } = await import('./PortalSubNav.svelte');

const ITEMS: readonly SubNavItem[] = [
	{ href: '/investor/', label: 'Overview', match: [] },
	{ href: '/investor/analyze/', label: 'Analyze', match: [] },
	{ href: '/investor/deals/', label: 'Deals', match: ['/investor/compare/', '/investor/memo/'] },
	{ href: '/investor/buy-boxes/', label: 'Buy boxes', match: [] },
	{ href: '/investor/markets/', label: 'Markets', match: ['/investor/market/'] }
];

describe('currentItemIndex', () => {
	test.each([
		['/investor/', '', 0],
		['/investor/analyze/', '', 1],
		['/investor/deals/', '', 2],
		['/investor/compare/', '', 2],
		['/investor/memo/', '', 2],
		['/investor/buy-boxes/', '', 3],
		['/investor/markets/', '', 4],
		['/investor/market/', '', 4],
		['/tran_real_estate/investor/deals/', '/tran_real_estate', 2],
		['/tran_real_estate/investor/', '/tran_real_estate', 0],
		['/tran_real_estate/investor/market/', '/tran_real_estate', 4],
		['/renter/', '', -1],
		['/tran_real_estate/renter/', '/tran_real_estate', -1],
		['/', '', -1]
	])('%s under base %j -> %i', (pathname, base, expected) => {
		expect(currentItemIndex(ITEMS, pathname, base)).toBe(expected);
	});

	test('a missing trailing slash still matches (query strings never reach the pathname)', () => {
		expect(currentItemIndex(ITEMS, '/investor/analyze', '')).toBe(1);
	});

	test('a base that is only a prefix of another segment is not stripped', () => {
		expect(currentItemIndex(ITEMS, '/tran_real_estate_x/investor/', '/tran_real_estate')).toBe(-1);
	});
});

describe('routeIdToPath', () => {
	test.each([
		['/(app)/investor', '/investor/'],
		['/(app)/investor/market', '/investor/market/'],
		['/(print)/print/memo', '/print/memo/'],
		['/', '/'],
		[null, null]
	])('%j -> %j', (id, expected) => {
		expect(routeIdToPath(id)).toBe(expected);
	});
});

const html = (props: Record<string, unknown>) =>
	render(PortalSubNav, { props }).body.replace(/<!--[\s\S]*?-->/g, '');
const links = (h: string) =>
	[...h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
		attrs: m[1],
		text: m[2].replace(/<[^>]+>/g, '').trim()
	}));

describe('PortalSubNav', () => {
	beforeEach(() => {
		state.page.route.id = '/(app)/investor';
	});

	test('one labelled landmark with a list of the given links, hrefs through resolve()', () => {
		const h = html({ label: 'Investor', items: ITEMS });
		expect(h.match(/<nav\b[^>]*aria-label="Investor"/g)).toHaveLength(1);
		expect(h).toMatch(/<nav\b[^>]*>\s*<ul\b/);
		const ls = links(h);
		expect(ls.map((l) => l.text)).toEqual(['Overview', 'Analyze', 'Deals', 'Buy boxes', 'Markets']);
		expect(ls.map((l) => /href="([^"]*)"/.exec(l.attrs)?.[1])).toEqual(ITEMS.map((i) => i.href));
	});

	test.each([
		['/(app)/investor', 'Overview'],
		['/(app)/investor/analyze', 'Analyze'],
		['/(app)/investor/deals', 'Deals'],
		['/(app)/investor/compare', 'Deals'],
		['/(app)/investor/memo', 'Deals'],
		['/(app)/investor/buy-boxes', 'Buy boxes'],
		['/(app)/investor/markets', 'Markets'],
		['/(app)/investor/market', 'Markets']
	])('route %s marks only %s as the current page', (id, label) => {
		state.page.route.id = id;
		const current = links(html({ label: 'Investor', items: ITEMS })).filter((l) =>
			l.attrs.includes('aria-current="page"')
		);
		expect(current.map((l) => l.text)).toEqual([label]);
	});

	test('an explicit currentPath wins over the route id', () => {
		const current = links(
			html({ label: 'Investor', items: ITEMS, currentPath: '/investor/buy-boxes/' })
		).filter((l) => l.attrs.includes('aria-current="page"'));
		expect(current.map((l) => l.text)).toEqual(['Buy boxes']);
	});

	test('no link is current outside the items', () => {
		state.page.route.id = '/(app)/settings';
		expect(html({ label: 'Investor', items: ITEMS })).not.toContain('aria-current');
	});

	test('44px targets, wrapping list, divider and the 2px primary underline on the current link', () => {
		const h = html({ label: 'Investor', items: ITEMS });
		expect(h).toMatch(/<nav\b[^>]*class="[^"]*\bborder-b\b[^"]*\bborder-border\b/);
		expect(h).toMatch(/<ul\b[^>]*class="[^"]*\bflex\b[^"]*\bflex-wrap\b/);
		expect(h).not.toMatch(/overflow-x-(auto|scroll)/);
		for (const l of links(h)) {
			expect(l.attrs).toMatch(/\bmin-h-11\b/);
			expect(l.attrs).toMatch(/\bpx-4\b/);
			expect(l.attrs).toContain('underline-offset-[6px]');
			expect(l.attrs).toContain('aria-[current=page]:decoration-primary');
			expect(l.attrs).toContain('aria-[current=page]:decoration-2');
			expect(l.attrs).toContain('aria-[current=page]:font-semibold');
		}
	});
});
