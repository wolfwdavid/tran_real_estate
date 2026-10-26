import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startFilter, type FilterDeps } from '../src/lib/filter';
import type { Timers } from '../src/lib/observe';
import { pillButton } from '../src/lib/reveal-host';
import { COUNT_PUSH, type CountPush } from '../src/lib/messages';
import { DEBOUNCE_MS, PILL_TAG, RETRY_MAX_MS, RETRY_MIN_MS } from '../src/lib/config';
import { adSlotFill, fixtureA, fixtureB, fixtureC, mount } from './fixtures/cards';

const SPONSORED_LI =
	'<li id="late-1" data-c11n-component="List.Item"><article data-testid="property-card"><span>Sponsored</span></article></li>';

function fakeSetting(initial: boolean) {
	let value = initial;
	const listeners = new Set<(n: boolean, o: boolean) => void>();
	return {
		getValue: async () => value,
		watch(cb: (n: boolean, o: boolean) => void) {
			listeners.add(cb);
			return () => {
				listeners.delete(cb);
			};
		},
		set(next: boolean) {
			const old = value;
			value = next;
			for (const cb of listeners) cb(next, old);
		},
		listeners
	};
}

function harness(initial = true) {
	const setting = fakeSetting(initial);
	const navigators: (() => void)[] = [];
	const published: CountPush[] = [];
	const delays: number[] = [];
	const timers: Timers = {
		setTimeout: (cb, ms) => {
			delays.push(ms);
			return setTimeout(cb, ms) as unknown as number;
		},
		clearTimeout: (id) => clearTimeout(id)
	};
	const deps: FilterDeps = {
		doc: document,
		setting: setting as unknown as FilterDeps['setting'],
		timers,
		onNavigate: (cb) => {
			navigators.push(cb);
		},
		publish: (push) => {
			published.push(push);
		}
	};
	return {
		deps,
		setting,
		published,
		delays,
		navigate: () => {
			for (const cb of navigators) cb();
		}
	};
}

const byId = (id: string): Element => {
	const el = document.getElementById(id);
	if (!el) throw new Error(`missing #${id}`);
	return el;
};

const anyMarks = (): number =>
	document.querySelectorAll(`[data-tran-slf], [data-tran-slf-pos], ${PILL_TAG}`).length;

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe('startFilter', () => {
	it('dims fixture A on start and publishes the count', async () => {
		mount(document, fixtureA.html);
		const h = harness();
		const ctl = await startFilter(h.deps);
		expect(ctl.count()).toBe(3);
		expect(ctl.enabled()).toBe(true);
		expect(h.published).toEqual([{ type: COUNT_PUSH, enabled: true, count: 3 }]);
		ctl.stop();
	});

	it('dims late-filled ad slots and appended cards after the debounce', async () => {
		const container = mount(document, fixtureB.html);
		const h = harness();
		const ctl = await startFilter(h.deps);
		expect(ctl.count()).toBe(3);
		const slot = byId('b-3');
		for (const child of [...slot.children]) {
			if (child.localName !== PILL_TAG) slot.removeChild(child);
		}
		slot.insertAdjacentHTML('beforeend', adSlotFill);
		container.querySelector('ul')!.insertAdjacentHTML('beforeend', SPONSORED_LI);
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
		expect(ctl.count()).toBe(3);
		await vi.advanceTimersByTimeAsync(1);
		expect(ctl.count()).toBe(4);
		expect(slot.getAttribute('data-tran-slf')).toBe('dimmed');
		expect(slot.querySelectorAll(PILL_TAG)).toHaveLength(1);
		expect(byId('late-1').getAttribute('data-tran-slf')).toBe('dimmed');
		expect(h.published.at(-1)).toEqual({ type: COUNT_PUSH, enabled: true, count: 4 });
		ctl.stop();
	});

	it('re-pills an ad slot whose whole content (pill included) was swapped for an iframe', async () => {
		mount(document, fixtureB.html);
		const h = harness();
		const ctl = await startFilter(h.deps);
		const slot = byId('b-3');
		slot.innerHTML = '<div><iframe></iframe></div>';
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		expect(slot.getAttribute('data-tran-slf')).toBe('dimmed');
		expect(slot.firstElementChild!.localName).toBe(PILL_TAG);
		expect(slot.querySelectorAll(PILL_TAG)).toHaveLength(1);
		expect(ctl.count()).toBe(3);
		ctl.stop();
	});

	it('undims a card when its badge text node changes to organic text', async () => {
		mount(document, fixtureA.html);
		const h = harness();
		const ctl = await startFilter(h.deps);
		const badge = byId('a-1').querySelector('[data-c11n-component="PropertyCard.Badge"]')!;
		(badge.firstChild as Text).data = 'Gas fireplace';
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		expect(byId('a-1').hasAttribute('data-tran-slf')).toBe(false);
		expect(byId('a-1').querySelector(PILL_TAG)).toBeNull();
		expect(ctl.count()).toBe(2);
		ctl.stop();
	});

	it('turning the setting off restores the page exactly; on re-dims', async () => {
		const container = mount(document, fixtureA.html);
		const before = container.outerHTML;
		const h = harness();
		const ctl = await startFilter(h.deps);
		h.setting.set(false);
		expect(anyMarks()).toBe(0);
		expect(container.outerHTML).toBe(before);
		expect(ctl.count()).toBe(0);
		expect(ctl.enabled()).toBe(false);
		expect(h.published.at(-1)).toEqual({ type: COUNT_PUSH, enabled: false, count: 0 });
		// Mutations while off never mark anything.
		container.querySelector('ul')!.insertAdjacentHTML('beforeend', SPONSORED_LI);
		await vi.advanceTimersByTimeAsync(1000);
		expect(anyMarks()).toBe(0);
		h.setting.set(true);
		expect(ctl.count()).toBe(4);
		expect(byId('a-1').getAttribute('data-tran-slf')).toBe('dimmed');
		expect(h.published.at(-1)).toEqual({ type: COUNT_PUSH, enabled: true, count: 4 });
		ctl.stop();
	});

	it('starts disabled without touching the page', async () => {
		const container = mount(document, fixtureA.html);
		const before = container.outerHTML;
		const h = harness(false);
		const ctl = await startFilter(h.deps);
		expect(ctl.count()).toBe(0);
		expect(container.outerHTML).toBe(before);
		expect(h.published).toEqual([{ type: COUNT_PUSH, enabled: false, count: 0 }]);
		ctl.stop();
	});

	it('re-acquires a replaced container on navigation and disconnects the old observer', async () => {
		const old = mount(document, fixtureA.html);
		const h = harness();
		const disconnect = vi.spyOn(window.MutationObserver.prototype, 'disconnect');
		const ctl = await startFilter(h.deps);
		expect(ctl.count()).toBe(3);
		h.navigate();
		// Navigation starts before the new DOM exists; the new container arrives afterwards.
		document.body.innerHTML = fixtureC.html;
		expect(old.isConnected).toBe(false);
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		for (const id of fixtureC.dimmed) {
			expect(byId(id).getAttribute('data-tran-slf')).toBe('dimmed');
		}
		for (const id of fixtureC.clean) expect(byId(id).hasAttribute('data-tran-slf')).toBe(false);
		expect(ctl.count()).toBe(3);
		expect(disconnect).toHaveBeenCalled();
		// The old container is no longer observed: mutating it changes nothing.
		const calls = h.published.length;
		old.querySelector('ul')!.insertAdjacentHTML('beforeend', SPONSORED_LI);
		await vi.advanceTimersByTimeAsync(1000);
		expect(h.published.length).toBe(calls);
		// The new one is: a late card is picked up.
		document
			.querySelector('#search-page-list-container ul')!
			.insertAdjacentHTML('beforeend', '<li id="c-9"><span>Sponsored</span></li>');
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		expect(ctl.count()).toBe(4);
		ctl.stop();
	});

	it('keeps re-checking after navigation and catches a container swapped late', async () => {
		mount(document, fixtureA.html);
		const h = harness();
		const ctl = await startFilter(h.deps);
		h.navigate();
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + RETRY_MIN_MS + 100);
		// The old container survived the navigation debounce; React swaps it only now.
		document.body.innerHTML = fixtureC.html;
		// Checks run at +250 and +750 after the navigation debounce; the next one catches the swap.
		await vi.advanceTimersByTimeAsync(2 * RETRY_MIN_MS - 100 - 1);
		expect(byId('c-3').hasAttribute('data-tran-slf')).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(byId('c-3').getAttribute('data-tran-slf')).toBe('dimmed');
		expect(ctl.count()).toBe(3);
		ctl.stop();
	});

	it('re-acquires a container swapped during a mutation burst, without a navigation event', async () => {
		const old = mount(document, fixtureA.html);
		const h = harness();
		const ctl = await startFilter(h.deps);
		old.querySelector('ul')!.insertAdjacentHTML('beforeend', SPONSORED_LI);
		await vi.advanceTimersByTimeAsync(50);
		document.body.innerHTML = fixtureC.html;
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		expect(byId('c-1').getAttribute('data-tran-slf')).toBe('dimmed');
		expect(ctl.count()).toBe(3);
		ctl.stop();
	});

	it('rescan() re-acquires a replaced container', async () => {
		mount(document, fixtureA.html);
		const h = harness();
		const ctl = await startFilter(h.deps);
		document.body.innerHTML = fixtureC.html;
		ctl.rescan();
		expect(byId('c-2').getAttribute('data-tran-slf')).toBe('dimmed');
		expect(ctl.count()).toBe(3);
		ctl.stop();
	});

	it('retries container discovery with doubling backoff capped at RETRY_MAX_MS', async () => {
		const h = harness();
		const ctl = await startFilter(h.deps);
		expect(ctl.count()).toBe(0);
		await vi.advanceTimersByTimeAsync(250 + 500 + 1000 + 2000 + 4000 + 4000);
		expect(h.delays.slice(0, 6)).toEqual([250, 500, 1000, 2000, 4000, 4000]);
		expect(h.delays[0]).toBe(RETRY_MIN_MS);
		expect(Math.max(...h.delays)).toBe(RETRY_MAX_MS);
		ctl.stop();
	});

	it('finds a container inserted late on the next retry and dims it', async () => {
		const h = harness();
		const ctl = await startFilter(h.deps);
		await vi.advanceTimersByTimeAsync(1200);
		mount(document, fixtureA.html);
		expect(ctl.count()).toBe(0);
		// Retries fire at 250, 750 and 1750 ms after start.
		await vi.advanceTimersByTimeAsync(549);
		expect(ctl.count()).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(ctl.count()).toBe(3);
		expect(byId('a-1').getAttribute('data-tran-slf')).toBe('dimmed');
		expect(h.published.at(-1)).toEqual({ type: COUNT_PUSH, enabled: true, count: 3 });
		ctl.stop();
	});

	it('never observes document.body or documentElement', async () => {
		const spy = vi.spyOn(window.MutationObserver.prototype, 'observe');
		const h = harness();
		const ctl = await startFilter(h.deps);
		await vi.advanceTimersByTimeAsync(20000);
		mount(document, fixtureA.html);
		await vi.advanceTimersByTimeAsync(5000);
		h.navigate();
		await vi.advanceTimersByTimeAsync(5000);
		expect(spy).toHaveBeenCalled();
		for (const [target, options] of spy.mock.calls) {
			expect(target).not.toBe(document.body);
			expect(target).not.toBe(document.documentElement);
			expect(options).not.toHaveProperty('attributes');
		}
		ctl.stop();
	});

	it('publishes count changes from pill toggles and deduplicates identical pushes', async () => {
		mount(document, fixtureA.html);
		const h = harness();
		const ctl = await startFilter(h.deps);
		expect(h.published).toHaveLength(1);
		ctl.rescan();
		ctl.rescan();
		expect(h.published).toHaveLength(1);
		const host = byId('a-1').firstElementChild as HTMLElement;
		pillButton(host)!.click();
		expect(ctl.count()).toBe(2);
		expect(h.published).toEqual([
			{ type: COUNT_PUSH, enabled: true, count: 3 },
			{ type: COUNT_PUSH, enabled: true, count: 2 }
		]);
		ctl.stop();
	});

	it('stop() disconnects, unwatches, cancels timers and restores the page', async () => {
		const container = mount(document, fixtureA.html);
		const before = container.outerHTML;
		const h = harness();
		const disconnect = vi.spyOn(window.MutationObserver.prototype, 'disconnect');
		const ctl = await startFilter(h.deps);
		container.querySelector('ul')!.insertAdjacentHTML('beforeend', SPONSORED_LI);
		h.navigate();
		ctl.stop();
		expect(disconnect).toHaveBeenCalled();
		expect(h.setting.listeners.size).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
		byId('late-1').remove();
		expect(container.outerHTML).toBe(before);
		const calls = h.published.length;
		await vi.advanceTimersByTimeAsync(10000);
		h.setting.set(false);
		h.setting.set(true);
		h.navigate();
		await vi.advanceTimersByTimeAsync(10000);
		expect(h.published.length).toBe(calls);
		expect(anyMarks()).toBe(0);
	});
});
