// SSR structural tests for the agent sub-nav (08-11). svelte/server renders the component to a
// string; $app/state is mocked because the Kit plugin is not loaded under Vitest.
import { render } from 'svelte/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ page: { route: { id: '/(app)/agent' as string | null } } }));
vi.mock('$app/state', () => state);

const { default: AgentNav } = await import('./AgentNav.svelte');

const html = (props: Record<string, unknown> = {}) =>
	render(AgentNav, { props }).body.replace(/<!--[\s\S]*?-->/g, '');
const links = (h: string) =>
	[...h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
		attrs: m[1],
		inner: m[2],
		text: m[2].replace(/<[^>]+>/g, '').trim()
	}));
/** The accessible name: aria-label wins; otherwise the text with aria-hidden subtrees dropped. */
const accessibleName = (l: { attrs: string; inner: string }) =>
	/aria-label="([^"]*)"/.exec(l.attrs)?.[1] ??
	l.inner
		.replace(/<span\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '')
		.replace(/<[^>]+>/g, '')
		.trim();

describe('AgentNav', () => {
	beforeEach(() => {
		state.page.route.id = '/(app)/agent';
	});

	test('one Agent tools landmark with the six links in fixed order, Studio last', () => {
		const h = html();
		expect(h.match(/<nav\b[^>]*aria-label="Agent tools"/g)).toHaveLength(1);
		const ls = links(h);
		expect(ls.map((l) => l.text)).toEqual([
			'Today',
			'Pipeline',
			'Contacts',
			'Import',
			'Profile',
			'Studio'
		]);
		expect(ls.map((l) => /href="([^"]*)"/.exec(l.attrs)?.[1])).toEqual([
			'/agent/today/',
			'/agent/pipeline/',
			'/agent/contacts/',
			'/agent/import/',
			'/agent/profile/',
			'/agent/studio/'
		]);
	});

	test.each([
		['/(app)/agent/today', 'Today'],
		['/(app)/agent/pipeline', 'Pipeline'],
		['/(app)/agent/contacts', 'Contacts'],
		['/(app)/agent/contact', 'Contacts'],
		['/(app)/agent/import', 'Import'],
		['/(app)/agent/profile', 'Profile'],
		['/(app)/agent/studio', 'Studio'],
		['/(app)/agent/studio/listing', 'Studio'],
		['/(app)/agent/studio/social', 'Studio'],
		['/(app)/agent/studio/reel', 'Studio'],
		['/(app)/agent/studio/snapshot', 'Studio']
	])('route %s marks only %s as the current page', (id, label) => {
		state.page.route.id = id;
		const current = links(html()).filter((l) => l.attrs.includes('aria-current="page"'));
		expect(current.map((l) => l.text)).toEqual([label]);
	});

	// '/(app)/agent/studiox' pins the Studio prefix match to the hub and its own children.
	test.each(['/(app)/agent', '/(app)/settings', '/(app)/agent/studiox', null])(
		'no link is current on %s',
		(id) => {
			state.page.route.id = id;
			expect(html()).not.toContain('aria-current');
		}
	);

	test('a due count renders a hidden-from-name pill and reads "Today, 3 tasks due"', () => {
		const [today, ...rest] = links(html({ dueCount: 3 }));
		expect(today.inner).toMatch(/<span\b[^>]*aria-hidden="true"[^>]*>3<\/span>/);
		expect(today.inner).toContain('bg-accent-surface');
		expect(today.attrs).toContain('aria-label="Today, 3 tasks due"');
		expect(accessibleName(today)).toBe('Today, 3 tasks due');
		// The label starts with the visible word (WCAG 2.5.3 label in name).
		expect(accessibleName(today).startsWith('Today')).toBe(true);
		// No visually hidden name fragment: being position: absolute, it would pad the computed
		// name with a space ("Today , 3 tasks due").
		expect(today.inner).not.toContain('sr-only');
		for (const l of rest) expect(l.attrs).not.toContain('aria-label');
	});

	test('a single due task reads "Today, 1 task due"', () => {
		const [today] = links(html({ dueCount: 1 }));
		expect(accessibleName(today)).toBe('Today, 1 task due');
	});

	test.each([undefined, 0, -2, 1.5])('dueCount %s renders no pill', (dueCount) => {
		const h = html(dueCount === undefined ? {} : { dueCount });
		expect(h).not.toContain('sr-only');
		expect(h).not.toContain('aria-hidden');
		expect(h).not.toContain('aria-label="Today');
		expect(links(h)[0].text).toBe('Today');
	});
});
