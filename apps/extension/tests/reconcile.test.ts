import { afterEach, describe, expect, it } from 'vitest';
import { reconcile, unmarkAll, type FilterState } from '../src/lib/reconcile';
import { pillButton } from '../src/lib/reveal-host';
import { CONFIG, PILL_TAG } from '../src/lib/config';
import { COPY } from '../src/lib/copy';
import { fixtureA, fixtureB, mount } from './fixtures/cards';

const byId = (id: string): Element => {
	const el = document.getElementById(id);
	if (!el) throw new Error(`missing #${id}`);
	return el;
};

const pills = (item: Element): Element[] =>
	[...item.children].filter((c) => c.localName === PILL_TAG);

function newState(enabled = true): FilterState & { changes: number } {
	const state = {
		enabled,
		revealed: new WeakSet<Element>(),
		changes: 0,
		onChange: () => {
			state.changes++;
		}
	};
	return state;
}

const hasMarks = (el: Element): boolean =>
	el.hasAttribute('data-tran-slf') || el.hasAttribute('data-tran-slf-pos');

afterEach(() => {
	document.body.replaceChildren();
});

describe('reconcile', () => {
	it('dims the sponsored items of fixture A and leaves organic items untouched', () => {
		const container = mount(document, fixtureA.html);
		expect(reconcile(container, newState(), CONFIG)).toBe(3);
		for (const id of fixtureA.dimmed) {
			const item = byId(id);
			expect(item.getAttribute('data-tran-slf')).toBe('dimmed');
			expect(pills(item)).toHaveLength(1);
			expect(item.firstElementChild!.localName).toBe(PILL_TAG);
		}
		for (const id of fixtureA.clean) {
			const item = byId(id);
			expect(hasMarks(item)).toBe(false);
			expect(item.querySelector(PILL_TAG)).toBeNull();
		}
	});

	it('is idempotent across repeated passes and never removes cards', () => {
		const container = mount(document, fixtureA.html);
		const lis = container.querySelectorAll('li').length;
		const articles = container.querySelectorAll('article').length;
		const state = newState();
		for (let i = 0; i < 5; i++) expect(reconcile(container, state, CONFIG)).toBe(3);
		for (const id of fixtureA.dimmed) expect(pills(byId(id))).toHaveLength(1);
		expect(container.querySelectorAll(PILL_TAG)).toHaveLength(3);
		expect(container.querySelectorAll('li')).toHaveLength(lis);
		expect(container.querySelectorAll('article')).toHaveLength(articles);
	});

	it('undims a recycled node whose label changed to organic text', () => {
		const container = mount(document, fixtureA.html);
		const state = newState();
		reconcile(container, state, CONFIG);
		const badge = byId('a-2').querySelector('[data-c11n-component="PropertyCard.Badge"]')!;
		(badge.firstChild as Text).data = 'Gas fireplace';
		expect(reconcile(container, state, CONFIG)).toBe(2);
		expect(hasMarks(byId('a-2'))).toBe(false);
		expect(byId('a-2').querySelector(PILL_TAG)).toBeNull();
	});

	it('toggles reveal from the pill, keeps focus on it, and excludes revealed items', () => {
		const container = mount(document, fixtureA.html);
		const state = newState();
		reconcile(container, state, CONFIG);
		const item = byId('a-1');
		const host = item.firstElementChild!;
		const btn = pillButton(host)!;
		btn.focus();
		btn.click();
		expect(item.getAttribute('data-tran-slf')).toBe('revealed');
		expect(btn.textContent!.startsWith(COPY.pillRevealed)).toBe(true);
		expect(btn.textContent!.startsWith('Sponsored — dim')).toBe(true);
		expect(state.changes).toBe(1);
		expect(reconcile(container, state, CONFIG)).toBe(2);
		expect(item.firstElementChild).toBe(host);
		expect(pillButton(host)).toBe(btn);
		expect((btn.getRootNode() as ShadowRoot).activeElement).toBe(btn);
		btn.click();
		expect(item.getAttribute('data-tran-slf')).toBe('dimmed');
		expect(btn.textContent!.startsWith(COPY.pillDimmed)).toBe(true);
		expect(state.changes).toBe(2);
		expect(reconcile(container, state, CONFIG)).toBe(3);
	});

	it('changes nothing at all when disabled', () => {
		const container = mount(document, fixtureA.html);
		const before = container.outerHTML;
		expect(reconcile(container, newState(false), CONFIG)).toBe(0);
		expect(container.outerHTML).toBe(before);
	});

	it('disabling after dimming restores the original markup', () => {
		const container = mount(document, fixtureA.html);
		const before = container.outerHTML;
		const state = newState();
		reconcile(container, state, CONFIG);
		expect(container.outerHTML).not.toBe(before);
		state.enabled = false;
		expect(reconcile(container, state, CONFIG)).toBe(0);
		expect(container.outerHTML).toBe(before);
	});

	it('unmarkAll restores the original markup byte-for-byte', () => {
		const container = mount(document, fixtureA.html);
		const before = container.outerHTML;
		reconcile(container, newState(), CONFIG);
		unmarkAll(document);
		expect(container.outerHTML).toBe(before);
		expect(document.querySelectorAll(PILL_TAG)).toHaveLength(0);
	});

	it('sets data-tran-slf-pos only on statically positioned items', () => {
		const container = mount(document, fixtureA.html);
		byId('a-2').setAttribute('style', 'position: relative');
		reconcile(container, newState(), CONFIG);
		expect(byId('a-1').hasAttribute('data-tran-slf-pos')).toBe(true);
		expect(byId('a-7').hasAttribute('data-tran-slf-pos')).toBe(true);
		expect(byId('a-2').hasAttribute('data-tran-slf-pos')).toBe(false);
		expect(byId('a-2').getAttribute('data-tran-slf')).toBe('dimmed');
	});

	it('keys reveal memory by node identity: a replacement clone comes back dimmed', () => {
		const container = mount(document, fixtureA.html);
		const state = newState();
		reconcile(container, state, CONFIG);
		const item = byId('a-1');
		pillButton(item.firstElementChild!)!.click();
		expect(item.getAttribute('data-tran-slf')).toBe('revealed');
		const clone = item.cloneNode(true) as Element;
		item.replaceWith(clone);
		expect(reconcile(container, state, CONFIG)).toBe(3);
		expect(clone.getAttribute('data-tran-slf')).toBe('dimmed');
		expect(pills(clone)).toHaveLength(1);
		expect(pillButton(clone.firstElementChild!)).not.toBeNull();
	});

	it('keeps an ad slot dimmed when its placeholder is swapped for an iframe', () => {
		const container = mount(document, fixtureB.html);
		const state = newState();
		expect(reconcile(container, state, CONFIG)).toBe(3);
		const slot = byId('b-3');
		const host = slot.firstElementChild!;
		expect(host.localName).toBe(PILL_TAG);
		// The unit loads: the placeholder content is replaced while our pill stays in place.
		for (const child of [...slot.children]) if (child !== host) slot.removeChild(child);
		slot.insertAdjacentHTML('beforeend', '<div><iframe></iframe></div>');
		expect(reconcile(container, state, CONFIG)).toBe(3);
		expect(slot.getAttribute('data-tran-slf')).toBe('dimmed');
		expect(slot.firstElementChild).toBe(host);
		expect(pills(slot)).toHaveLength(1);
		// A full child replacement (pill included) gets a fresh pill on the next pass.
		slot.innerHTML = '<div><iframe></iframe></div>';
		expect(reconcile(container, state, CONFIG)).toBe(3);
		expect(slot.getAttribute('data-tran-slf')).toBe('dimmed');
		expect(pills(slot)).toHaveLength(1);
		expect(pillButton(slot.firstElementChild!)).not.toBeNull();
		expect(slot.querySelector('iframe')).not.toBeNull();
	});
});
