import { type FilterConfig, PILL_TAG } from './config';
import { classify, itemsIn } from './detect';
import { ensurePill, pillButton, removePill } from './reveal-host';

/**
 * Idempotent reconcile pass (RESEARCH Pattern 2). Every pass recomputes the classification of
 * every item in the results container: matches are marked and get exactly one pill, everything
 * else is unmarked. That makes it safe against virtualized lists that recycle a node for a
 * different (organic) listing, and against ad slots whose content is swapped under the item.
 * Items are only ever annotated, never removed, hidden, resized or reordered.
 */

export interface FilterState {
	enabled: boolean;
	/** Items the user revealed. Keyed by node identity only: no ids, no URLs, never persisted. */
	revealed: WeakSet<Element>;
	/** Called after the user toggles a pill, so the caller can recount and publish. */
	onChange: () => void;
}

const STATE_ATTR = 'data-tran-slf';
const POS_ATTR = 'data-tran-slf-pos';

/**
 * Drop pill-tag children that are not live pill hosts. These only appear when a marked item is
 * cloned (cloneNode copies the host element but not its closed shadow root or registration).
 */
function dropStrayHosts(item: Element): void {
	for (const child of [...item.children]) {
		if (child.localName === PILL_TAG && pillButton(child) === null) item.removeChild(child);
	}
}

function unmark(item: Element): void {
	if (item.hasAttribute(STATE_ATTR)) item.removeAttribute(STATE_ATTR);
	if (item.hasAttribute(POS_ATTR)) item.removeAttribute(POS_ATTR);
	removePill(item);
	dropStrayHosts(item);
}

function isStaticallyPositioned(item: Element): boolean {
	const view = item.ownerDocument.defaultView;
	if (!view) return true;
	const position = view.getComputedStyle(item).position;
	return position === 'static' || position === '';
}

function mark(item: Element, state: FilterState): void {
	const revealed = state.revealed.has(item);
	const value = revealed ? 'revealed' : 'dimmed';
	if (item.getAttribute(STATE_ATTR) !== value) item.setAttribute(STATE_ATTR, value);
	// Once set, the stylesheet makes the item relative, so keep the marker until unmark.
	if (!item.hasAttribute(POS_ATTR) && isStaticallyPositioned(item)) item.setAttribute(POS_ATTR, '');
	dropStrayHosts(item);
	ensurePill(item, revealed, () => {
		if (state.revealed.has(item)) state.revealed.delete(item);
		else state.revealed.add(item);
		mark(item, state);
		state.onChange();
	});
}

/** Mark matches, unmark everything else. Returns the dimmed count (revealed excluded, 0 when off). */
export function reconcile(container: Element, state: FilterState, cfg: FilterConfig): number {
	let dimmed = 0;
	for (const item of itemsIn(container, cfg)) {
		const hit = state.enabled ? classify(item, cfg) : null;
		if (!hit) {
			unmark(item);
			continue;
		}
		mark(item, state);
		if (!state.revealed.has(item)) dimmed++;
	}
	if (!state.enabled) unmarkAll(container);
	return dimmed;
}

/** Remove every filter attribute and every pill host under `root`, restoring the page exactly. */
export function unmarkAll(root: ParentNode): void {
	for (const host of root.querySelectorAll(PILL_TAG)) {
		const parent = host.parentElement;
		if (!parent) continue;
		removePill(parent);
		dropStrayHosts(parent);
	}
	for (const el of root.querySelectorAll(`[${STATE_ATTR}], [${POS_ATTR}]`)) {
		el.removeAttribute(STATE_ATTR);
		el.removeAttribute(POS_ATTR);
	}
}
