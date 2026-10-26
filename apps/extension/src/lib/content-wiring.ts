import { startFilter, type FilterController } from './filter';
import { createResponder, type CountPush } from './messages';
import type { EnabledSetting } from './settings';

/**
 * The content script's whole main body, with the browser and WXT context injected so it is
 * unit-testable. Messages carry only { type, enabled, count }: never page text, URLs, ids or
 * listing data.
 */

type Responder = ReturnType<typeof createResponder>;

export interface RuntimeLike {
	sendMessage(m: CountPush): Promise<unknown>;
	onMessage: {
		addListener(l: Responder): void;
		removeListener(l: Responder): void;
	};
}

export interface CtxLike {
	setTimeout(cb: () => void, ms: number): number;
	addEventListener(target: Window, type: 'wxt:locationchange', cb: () => void): void;
	onInvalidated(cb: () => void): void;
}

export interface ContentDeps {
	doc: Document;
	win: Window;
	runtime: RuntimeLike;
	setting: Pick<EnabledSetting, 'getValue' | 'watch'>;
}

export async function wireContent(ctx: CtxLike, deps: ContentDeps): Promise<FilterController> {
	const filter = await startFilter({
		doc: deps.doc,
		setting: deps.setting,
		// ctx.setTimeout is cancelled automatically when the context is invalidated.
		timers: {
			setTimeout: (cb, ms) => ctx.setTimeout(cb, ms),
			clearTimeout: (id) => deps.win.clearTimeout(id)
		},
		onNavigate: (cb) => ctx.addEventListener(deps.win, 'wxt:locationchange', () => cb()),
		publish: (push) => {
			// No listener (popup closed, worker asleep) rejects; that is expected, not an error.
			deps.runtime.sendMessage(push).catch(() => {});
		}
	});
	const responder = createResponder(() => ({ enabled: filter.enabled(), count: filter.count() }));
	deps.runtime.onMessage.addListener(responder);
	ctx.onInvalidated(() => {
		deps.runtime.onMessage.removeListener(responder);
		filter.stop();
	});
	return filter;
}
