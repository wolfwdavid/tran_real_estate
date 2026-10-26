import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wireContent, type CtxLike, type RuntimeLike } from '../src/lib/content-wiring';
import { COUNT_PUSH, GET_COUNT, type CountPush, type CountResponse } from '../src/lib/messages';
import { PILL_TAG } from '../src/lib/config';
import { fixtureA, mount } from './fixtures/cards';

type Listener = (
	msg: unknown,
	sender: unknown,
	sendResponse: (r: CountResponse) => void
) => unknown;

function fakeRuntime(reject = false) {
	const listeners = new Set<Listener>();
	const sent: CountPush[] = [];
	const runtime = {
		sendMessage: vi.fn(async (m: CountPush) => {
			sent.push(m);
			if (reject) throw new Error('Could not establish connection. Receiving end does not exist.');
			return undefined;
		}),
		onMessage: {
			addListener: vi.fn((l: Listener) => {
				listeners.add(l);
			}),
			removeListener: vi.fn((l: Listener) => {
				listeners.delete(l);
			})
		}
	};
	return { runtime: runtime as unknown as RuntimeLike, raw: runtime, listeners, sent };
}

function fakeCtx() {
	const invalidators: (() => void)[] = [];
	const nav: (() => void)[] = [];
	const events: { target: unknown; type: string }[] = [];
	const ctx: CtxLike = {
		setTimeout: (cb, ms) => setTimeout(cb, ms) as unknown as number,
		addEventListener: (target, type, cb) => {
			events.push({ target, type });
			nav.push(cb);
		},
		onInvalidated: (cb) => {
			invalidators.push(cb);
		}
	};
	return { ctx, invalidators, nav, events, invalidate: () => invalidators.forEach((cb) => cb()) };
}

function fakeSetting(initial = true) {
	return {
		getValue: async () => initial,
		watch: () => () => {}
	};
}

const deps = (runtime: RuntimeLike) => ({
	doc: document,
	win: window,
	runtime,
	setting: fakeSetting() as never
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	document.body.replaceChildren();
});

describe('wireContent', () => {
	it('registers exactly one listener that answers get-count with the live status', async () => {
		mount(document, fixtureA.html);
		const rt = fakeRuntime();
		const c = fakeCtx();
		const ctl = await wireContent(c.ctx, deps(rt.runtime));
		expect(rt.raw.onMessage.addListener).toHaveBeenCalledTimes(1);
		const listener = [...rt.listeners][0]!;
		const sendResponse = vi.fn();
		const ret = listener({ type: GET_COUNT }, {}, sendResponse);
		expect(ret).toBe(true);
		expect(sendResponse).toHaveBeenCalledWith({ enabled: true, count: 3 });
		expect(listener({ type: 'other' }, {}, vi.fn())).toBeUndefined();
		ctl.stop();
	});

	it('publishes count pushes carrying only type, enabled and count', async () => {
		mount(document, fixtureA.html);
		const rt = fakeRuntime();
		const ctl = await wireContent(fakeCtx().ctx, deps(rt.runtime));
		expect(rt.sent).toEqual([{ type: COUNT_PUSH, enabled: true, count: 3 }]);
		expect(Object.keys(rt.sent[0]!).sort()).toEqual(['count', 'enabled', 'type']);
		ctl.stop();
	});

	it('swallows sendMessage rejections when nothing is listening', async () => {
		mount(document, fixtureA.html);
		const rt = fakeRuntime(true);
		const unhandled = vi.fn();
		process.on('unhandledRejection', unhandled);
		const ctl = await wireContent(fakeCtx().ctx, deps(rt.runtime));
		await vi.advanceTimersByTimeAsync(0);
		await Promise.resolve();
		process.off('unhandledRejection', unhandled);
		expect(rt.raw.sendMessage).toHaveBeenCalled();
		expect(unhandled).not.toHaveBeenCalled();
		ctl.stop();
	});

	it('listens for wxt:locationchange on the window', async () => {
		mount(document, fixtureA.html);
		const c = fakeCtx();
		const ctl = await wireContent(c.ctx, deps(fakeRuntime().runtime));
		expect(c.events).toEqual([{ target: window, type: 'wxt:locationchange' }]);
		ctl.stop();
	});

	it('on invalidation removes the listener and restores the page exactly', async () => {
		mount(document, fixtureA.html);
		const before = document.body.innerHTML;
		const rt = fakeRuntime();
		const c = fakeCtx();
		await wireContent(c.ctx, deps(rt.runtime));
		expect(document.querySelectorAll('[data-tran-slf]').length).toBe(3);
		c.invalidate();
		expect(rt.raw.onMessage.removeListener).toHaveBeenCalledTimes(1);
		expect(rt.listeners.size).toBe(0);
		expect(
			document.querySelectorAll(`[data-tran-slf], [data-tran-slf-pos], ${PILL_TAG}`)
		).toHaveLength(0);
		expect(document.body.innerHTML).toBe(before);
	});
});
