import { COPY } from './copy';
import { PILL_TAG } from './config';
import { PILL_CSS } from './pill-css';

/**
 * The per-item reveal pill (RESEARCH Pattern 4). The host is an unregistered custom tag
 * prepended as the dimmed item's first child, so the dim rule (which targets the item's
 * other children) never touches it and it comes first in tab order. The button lives in a
 * CLOSED shadow root styled by one constructable sheet per document, which works under a
 * strict page style-src. No assumption is made about what the item contains: it may be a
 * property-card article, a list item wrapping one, or an ad-slot li wrapping an iframe.
 */

const sheets = new WeakMap<Document, CSSStyleSheet>();
const roots = new WeakMap<Element, ShadowRoot>();
const toggles = new WeakMap<HTMLButtonElement, () => void>();

const SWALLOWED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick'] as const;

function sheetFor(doc: Document): CSSStyleSheet {
	let sheet = sheets.get(doc);
	if (!sheet) {
		// Constructable sheets can only be adopted in the realm that created them.
		const Ctor = (doc.defaultView as (Window & typeof globalThis) | null)?.CSSStyleSheet;
		sheet = Ctor ? new Ctor() : new CSSStyleSheet();
		sheet.replaceSync(PILL_CSS);
		sheets.set(doc, sheet);
	}
	return sheet;
}

function findHost(item: Element): Element | null {
	for (const child of item.children) {
		if (child.localName === PILL_TAG && roots.has(child)) return child;
	}
	return null;
}

function createHost(item: Element): Element {
	const doc = item.ownerDocument;
	const host = doc.createElement(PILL_TAG);
	host.setAttribute('data-tran-slf-pill', '');
	const root = host.attachShadow({ mode: 'closed' });
	root.adoptedStyleSheets = [sheetFor(doc)];
	const btn = doc.createElement('button');
	btn.type = 'button';
	btn.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		toggles.get(btn)?.();
	});
	for (const type of SWALLOWED) {
		btn.addEventListener(type, (e) => e.stopPropagation());
	}
	root.append(btn);
	roots.set(host, root);
	item.prepend(host);
	return host;
}

/** Ensure exactly one pill on `item`, render the state's copy, and bind the latest callback. */
export function ensurePill(
	item: Element,
	revealed: boolean,
	onToggle: () => void
): HTMLButtonElement {
	let host = findHost(item);
	if (!host) host = createHost(item);
	else if (item.firstElementChild !== host) item.prepend(host);
	const btn = pillButton(host)!;
	toggles.set(btn, onToggle);

	const state = revealed ? 'revealed' : 'dimmed';
	if (btn.dataset.state !== state) {
		const doc = item.ownerDocument;
		const hidden = doc.createElement('span');
		hidden.className = 'vh';
		hidden.textContent = revealed ? COPY.pillRevealedHidden : COPY.pillDimmedHidden;
		btn.replaceChildren(doc.createTextNode(revealed ? COPY.pillRevealed : COPY.pillDimmed), hidden);
		btn.dataset.state = state;
	}
	return btn;
}

/** Remove the pill host from `item`, leaving the item exactly as it was before. */
export function removePill(item: Element): void {
	const host = findHost(item);
	if (!host) return;
	roots.delete(host);
	host.remove();
}

/** The button inside a pill host's closed shadow root, or null for anything else. */
export function pillButton(host: Element): HTMLButtonElement | null {
	return roots.get(host)?.querySelector('button') ?? null;
}
