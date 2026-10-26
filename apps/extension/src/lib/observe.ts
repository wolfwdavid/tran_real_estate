import { DEBOUNCE_MS, MAX_WAIT_MS, PILL_TAG } from './config';

/**
 * Scoped, debounced observer on the results container (RESEARCH Pattern 3). It watches child
 * lists and text only, never attribute writes (our own markers would loop), never a whole
 * document, and ignores records made solely of our own pill hosts. A burst of mutations
 * flushes once, DEBOUNCE_MS after the last one, or at most MAX_WAIT_MS after the first.
 */

export interface Timers {
	setTimeout(cb: () => void, ms: number): number;
	clearTimeout(id: number): void;
}

export interface ObserverHandle {
	disconnect(): void;
}

const OPTIONS: MutationObserverInit = { childList: true, subtree: true, characterData: true };

const isPillHost = (node: Node): boolean =>
	node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === PILL_TAG;

/** True for a child-list record whose added and removed nodes are all our pill hosts. */
export function isOwnMutation(record: MutationRecord): boolean {
	if (record.type !== 'childList') return false;
	const nodes = [...record.addedNodes, ...record.removedNodes];
	return nodes.length > 0 && nodes.every(isPillHost);
}

export function observeContainer(
	container: Element,
	onFlush: () => void,
	timers: Timers,
	opts?: { debounceMs?: number; maxWaitMs?: number }
): ObserverHandle {
	const debounceMs = opts?.debounceMs ?? DEBOUNCE_MS;
	const maxWaitMs = opts?.maxWaitMs ?? MAX_WAIT_MS;
	let trailing: number | null = null;
	let ceiling: number | null = null;

	const cancel = (): void => {
		if (trailing !== null) timers.clearTimeout(trailing);
		if (ceiling !== null) timers.clearTimeout(ceiling);
		trailing = null;
		ceiling = null;
	};

	const flush = (): void => {
		cancel();
		onFlush();
	};

	const schedule = (): void => {
		if (trailing !== null) timers.clearTimeout(trailing);
		trailing = timers.setTimeout(flush, debounceMs);
		if (ceiling === null) ceiling = timers.setTimeout(flush, maxWaitMs);
	};

	const View = container.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
	const observer = new View((records) => {
		if (records.some((r) => !isOwnMutation(r))) schedule();
	});
	observer.observe(container, OPTIONS);

	return {
		disconnect() {
			observer.disconnect();
			cancel();
		}
	};
}
