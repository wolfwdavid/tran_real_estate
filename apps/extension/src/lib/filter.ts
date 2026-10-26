import { CONFIG, DEBOUNCE_MS, type FilterConfig, RETRY_MAX_MS, RETRY_MIN_MS } from './config';
import { findContainer } from './detect';
import { COUNT_PUSH, type CountPush } from './messages';
import { type ObserverHandle, type Timers, observeContainer } from './observe';
import { type FilterState, reconcile, unmarkAll } from './reconcile';
import type { EnabledSetting } from './settings';

/**
 * The content-script controller: wires the detector, reconcile pass, scoped observer, the
 * enabled setting and SPA navigation together. Every dependency is injected (document, timers,
 * setting, navigation hook, publisher), so the entrypoint is thin wiring and tests drive this
 * directly with fixtures and fake timers.
 */

export interface FilterDeps {
	doc: Document;
	cfg?: FilterConfig;
	setting: Pick<EnabledSetting, 'getValue' | 'watch'>;
	timers: Timers;
	/** Register a callback for in-page navigation (wxt:locationchange). Fires at navigation start. */
	onNavigate(cb: () => void): void;
	publish(push: CountPush): void;
}

export interface FilterController {
	count(): number;
	enabled(): boolean;
	rescan(): void;
	stop(): void;
}

/** After a navigation, keep re-checking the container a few times in case React swaps it late. */
const NAV_VERIFY_CHECKS = 4;

export async function startFilter(deps: FilterDeps): Promise<FilterController> {
	const { doc, timers } = deps;
	const cfg = deps.cfg ?? CONFIG;

	let stopped = false;
	let container: Element | null = null;
	let handle: ObserverHandle | null = null;
	let current = 0;
	let last: { enabled: boolean; count: number } | null = null;
	let checkTimer: number | null = null;
	let checkDelay = RETRY_MIN_MS;
	let verifyLeft = 0;
	let navTimer: number | null = null;

	const state: FilterState = {
		enabled: true,
		revealed: new WeakSet<Element>(),
		onChange: () => {
			if (!stopped) run();
		}
	};

	function publish(): void {
		if (last && last.enabled === state.enabled && last.count === current) return;
		last = { enabled: state.enabled, count: current };
		deps.publish({ type: COUNT_PUSH, enabled: state.enabled, count: current });
	}

	function run(): void {
		current = container ? reconcile(container, state, cfg) : 0;
		publish();
	}

	/** Point the observer at the current results container. Returns true when it changed. */
	function acquire(): boolean {
		const next = findContainer(doc, cfg);
		if (next === container) return false;
		handle?.disconnect();
		handle = null;
		if (container) unmarkAll(container);
		container = next;
		if (next) handle = observeContainer(next, onFlush, timers);
		return true;
	}

	function onFlush(): void {
		if (stopped) return;
		if (!container?.isConnected) {
			acquire();
			if (!container) {
				run();
				restartChecks(0);
				return;
			}
		}
		run();
	}

	function clearCheck(): void {
		if (checkTimer !== null) timers.clearTimeout(checkTimer);
		checkTimer = null;
	}

	/** Restart the container check loop: RETRY_MIN_MS doubling to RETRY_MAX_MS. */
	function restartChecks(verify: number): void {
		clearCheck();
		checkDelay = RETRY_MIN_MS;
		verifyLeft = verify;
		scheduleCheck();
	}

	function scheduleCheck(): void {
		if (stopped || checkTimer !== null) return;
		checkTimer = timers.setTimeout(() => {
			checkTimer = null;
			if (stopped) return;
			if (acquire()) run();
			const keepGoing = container === null || verifyLeft-- > 0;
			if (!keepGoing) return;
			checkDelay = Math.min(checkDelay * 2, RETRY_MAX_MS);
			scheduleCheck();
		}, checkDelay);
	}

	let watched = false;
	const unwatch = deps.setting.watch((value) => {
		watched = true;
		if (stopped) return;
		state.enabled = value;
		if (!value) unmarkAll(doc);
		run();
	});

	const initial = await deps.setting.getValue();
	if (!watched) state.enabled = initial;

	deps.onNavigate(() => {
		if (stopped) return;
		if (navTimer !== null) timers.clearTimeout(navTimer);
		// The event fires before the new DOM exists, so re-acquire after the debounce.
		navTimer = timers.setTimeout(() => {
			navTimer = null;
			if (stopped) return;
			acquire();
			run();
			restartChecks(container ? NAV_VERIFY_CHECKS : 0);
		}, DEBOUNCE_MS);
	});

	if (!stopped) {
		acquire();
		run();
		if (!container) restartChecks(0);
	}

	return {
		count: () => current,
		enabled: () => state.enabled,
		rescan: () => {
			if (!stopped) onFlush();
		},
		stop: () => {
			if (stopped) return;
			stopped = true;
			unwatch();
			handle?.disconnect();
			handle = null;
			clearCheck();
			if (navTimer !== null) timers.clearTimeout(navTimer);
			navTimer = null;
			unmarkAll(doc);
			container = null;
			current = 0;
		}
	};
}
