import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isOwnMutation, observeContainer, type Timers } from '../src/lib/observe';
import { reconcile } from '../src/lib/reconcile';
import { CONFIG, DEBOUNCE_MS, MAX_WAIT_MS, PILL_TAG } from '../src/lib/config';
import { fixtureA, mount } from './fixtures/cards';

const timers: Timers = {
	setTimeout: (cb, ms) => setTimeout(cb, ms) as unknown as number,
	clearTimeout: (id) => clearTimeout(id)
};

const SPONSORED_LI =
	'<li data-c11n-component="List.Item"><article data-testid="property-card"><span>Sponsored</span></article></li>';

function appendSponsored(container: Element): void {
	container.querySelector('ul')!.insertAdjacentHTML('beforeend', SPONSORED_LI);
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe('observeContainer', () => {
	it('observes only the container, without attributes', () => {
		const container = mount(document, fixtureA.html);
		const spy = vi.spyOn(window.MutationObserver.prototype, 'observe');
		const handle = observeContainer(container, () => {}, timers);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0]![0]).toBe(container);
		expect(spy.mock.calls[0]![1]).toEqual({ childList: true, subtree: true, characterData: true });
		for (const [target] of spy.mock.calls) {
			expect(target).not.toBe(document.body);
			expect(target).not.toBe(document.documentElement);
		}
		handle.disconnect();
	});

	it('flushes once, DEBOUNCE_MS after a late insertion', async () => {
		const container = mount(document, fixtureA.html);
		const onFlush = vi.fn();
		const handle = observeContainer(container, onFlush, timers);
		appendSponsored(container);
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
		expect(onFlush).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(onFlush).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(2000);
		expect(onFlush).toHaveBeenCalledTimes(1);
		handle.disconnect();
	});

	it('caps a continuous mutation stream at MAX_WAIT_MS', async () => {
		const container = mount(document, fixtureA.html);
		const onFlush = vi.fn();
		const handle = observeContainer(container, onFlush, timers);
		appendSponsored(container);
		for (let t = 100; t < MAX_WAIT_MS; t += 100) {
			await vi.advanceTimersByTimeAsync(100);
			expect(onFlush).not.toHaveBeenCalled();
			appendSponsored(container);
		}
		await vi.advanceTimersByTimeAsync(100);
		expect(onFlush).toHaveBeenCalledTimes(1);
		handle.disconnect();
	});

	it('flushes on character data changes', async () => {
		const container = mount(document, fixtureA.html);
		const onFlush = vi.fn();
		const handle = observeContainer(container, onFlush, timers);
		const badge = container.querySelector('[data-c11n-component="PropertyCard.Badge"]')!;
		(badge.firstChild as Text).data = 'Gas fireplace';
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		expect(onFlush).toHaveBeenCalledTimes(1);
		handle.disconnect();
	});

	it('isOwnMutation recognises pill-only records and nothing else', () => {
		const host = document.createElement(PILL_TAG);
		const div = document.createElement('div');
		const rec = (added: Node[], removed: Node[], type: MutationRecordType = 'childList') =>
			({
				type,
				addedNodes: added as unknown as NodeList,
				removedNodes: removed as unknown as NodeList
			}) as MutationRecord;
		expect(isOwnMutation(rec([host], []))).toBe(true);
		expect(isOwnMutation(rec([], [host]))).toBe(true);
		expect(isOwnMutation(rec([host], [host]))).toBe(true);
		expect(isOwnMutation(rec([host, div], []))).toBe(false);
		expect(isOwnMutation(rec([], [div]))).toBe(false);
		expect(isOwnMutation(rec([], [], 'characterData'))).toBe(false);
	});

	it('does not schedule a flush for its own pill insertions (no loop)', async () => {
		const container = mount(document, fixtureA.html);
		const state = { enabled: true, revealed: new WeakSet<Element>(), onChange: () => {} };
		const onFlush = vi.fn(() => reconcile(container, state, CONFIG));
		const handle = observeContainer(container, onFlush, timers);
		expect(reconcile(container, state, CONFIG)).toBe(3);
		await vi.advanceTimersByTimeAsync(2000);
		expect(onFlush).toHaveBeenCalledTimes(0);
		// A real change flushes once; the pill that pass inserts does not re-trigger.
		appendSponsored(container);
		await vi.advanceTimersByTimeAsync(2000);
		expect(onFlush).toHaveBeenCalledTimes(1);
		expect(container.querySelectorAll(PILL_TAG)).toHaveLength(4);
		handle.disconnect();
	});

	it('disconnect stops observing and cancels a pending flush', async () => {
		const container = mount(document, fixtureA.html);
		const onFlush = vi.fn();
		const handle = observeContainer(container, onFlush, timers);
		appendSponsored(container);
		await vi.advanceTimersByTimeAsync(50);
		handle.disconnect();
		appendSponsored(container);
		await vi.advanceTimersByTimeAsync(2000);
		expect(onFlush).not.toHaveBeenCalled();
	});
});
