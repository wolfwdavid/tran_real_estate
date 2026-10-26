import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { ensurePill, pillButton, removePill } from '../src/lib/reveal-host';
import { PILL_TAG } from '../src/lib/config';
import { COPY } from '../src/lib/copy';

const CARD_HTML =
	'<li data-c11n-component="List.Item"><article data-testid="property-card"><a href="/homedetails/1">Card</a></article></li>';

function mountCard(doc: Document = document) {
	const ul = doc.createElement('ul');
	ul.innerHTML = CARD_HTML;
	doc.body.append(ul);
	return ul.querySelector('li')!;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('ensurePill', () => {
	it('inserts one host as the first child, marked and closed', () => {
		const li = mountCard();
		ensurePill(li, false, () => {});
		const host = li.firstElementChild!;
		expect(host.localName).toBe(PILL_TAG);
		expect(host.hasAttribute('data-tran-slf-pill')).toBe(true);
		expect(host.shadowRoot).toBeNull();
		expect(li.querySelectorAll(PILL_TAG)).toHaveLength(1);
	});

	it('renders a real button with label-in-name text and no aria overrides', () => {
		const li = mountCard();
		const btn = ensurePill(li, false, () => {});
		expect(pillButton(li.firstElementChild!)).toBe(btn);
		expect(btn.localName).toBe('button');
		expect(btn.type).toBe('button');
		expect(btn.textContent).toBe(COPY.pillDimmed + COPY.pillDimmedHidden);
		expect(btn.textContent).toBe('Sponsored — show this listing (dimmed by Sponsored Listing Filter)');
		expect(btn.firstChild!.nodeType).toBe(3);
		expect(btn.firstChild!.textContent).toBe('Sponsored — show');
		const vh = btn.querySelector('span.vh')!;
		expect(vh.textContent).toBe(COPY.pillDimmedHidden);
		expect(btn.hasAttribute('aria-label')).toBe(false);
		expect(btn.hasAttribute('aria-pressed')).toBe(false);
		expect(btn.dataset.state).toBe('dimmed');
	});

	it('is idempotent: a second call reuses the same host and button', () => {
		const li = mountCard();
		const a = ensurePill(li, false, () => {});
		const host = li.firstElementChild;
		const b = ensurePill(li, false, () => {});
		expect(b).toBe(a);
		expect(li.firstElementChild).toBe(host);
		expect(li.querySelectorAll(PILL_TAG)).toHaveLength(1);
	});

	it('switches to revealed copy and state', () => {
		const li = mountCard();
		ensurePill(li, false, () => {});
		const btn = ensurePill(li, true, () => {});
		expect(btn.firstChild!.textContent).toBe('Sponsored — dim');
		expect(btn.textContent).toBe(COPY.pillRevealed + COPY.pillRevealedHidden);
		expect(btn.textContent).toBe('Sponsored — dim this listing again');
		expect(btn.dataset.state).toBe('revealed');
	});

	it('shares one constructable sheet per document and a new one per realm', () => {
		const a = mountCard();
		const b = mountCard();
		ensurePill(a, false, () => {});
		ensurePill(b, false, () => {});
		const rootA = pillButton(a.firstElementChild!)!.getRootNode() as ShadowRoot;
		const rootB = pillButton(b.firstElementChild!)!.getRootNode() as ShadowRoot;
		expect(rootA).not.toBe(rootB);
		expect(rootA.adoptedStyleSheets).toHaveLength(1);
		expect(rootB.adoptedStyleSheets[0]).toBe(rootA.adoptedStyleSheets[0]);
		expect(rootA.querySelector('style')).toBeNull();

		const other = new Window({ url: 'https://www.zillow.com/homes/' });
		try {
			const c = mountCard(other.document as unknown as Document);
			ensurePill(c, false, () => {});
			const rootC = pillButton(c.firstElementChild!)!.getRootNode() as ShadowRoot;
			expect(rootC.adoptedStyleSheets).toHaveLength(1);
			expect(rootC.adoptedStyleSheets[0]).not.toBe(rootA.adoptedStyleSheets[0]);
		} finally {
			void other.happyDOM.close();
		}
	});
});

describe('pill events', () => {
	it('click toggles once and never reaches the card, item or body', () => {
		const li = mountCard();
		const article = li.querySelector('article')!;
		const onToggle = vi.fn();
		const cardClick = vi.fn();
		const itemClick = vi.fn();
		article.addEventListener('click', cardClick);
		li.addEventListener('click', itemClick);
		document.body.addEventListener('click', itemClick);
		const btn = ensurePill(li, false, onToggle);
		btn.click();
		expect(onToggle).toHaveBeenCalledTimes(1);
		expect(cardClick).not.toHaveBeenCalled();
		expect(itemClick).not.toHaveBeenCalled();
		document.body.removeEventListener('click', itemClick);
	});

	it('click is default-prevented', () => {
		const li = mountCard();
		const btn = ensurePill(li, false, () => {});
		const ev = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
		btn.dispatchEvent(ev);
		expect(ev.defaultPrevented).toBe(true);
	});

	it.each(['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick'])(
		'%s does not propagate to the item',
		(type) => {
			const li = mountCard();
			const onToggle = vi.fn();
			const spy = vi.fn();
			li.addEventListener(type, spy);
			const btn = ensurePill(li, false, onToggle);
			btn.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true }));
			expect(spy).not.toHaveBeenCalled();
			expect(onToggle).not.toHaveBeenCalled();
		}
	);

	it('re-ensure swaps the callback without adding listeners', () => {
		const li = mountCard();
		const first = vi.fn();
		const second = vi.fn();
		ensurePill(li, false, first);
		const btn = ensurePill(li, true, second);
		btn.click();
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});

	it('keeps focus on the pill after activation and re-render', () => {
		const li = mountCard();
		let revealed = false;
		const toggle = () => {
			revealed = !revealed;
			ensurePill(li, revealed, toggle);
		};
		const btn = ensurePill(li, revealed, toggle);
		btn.focus();
		btn.click();
		const root = btn.getRootNode() as ShadowRoot;
		expect(root.activeElement).toBe(btn);
		expect(btn.dataset.state).toBe('revealed');
	});
});

describe('ad-slot items (li wrapping an iframe, no property card)', () => {
	it('mounts on a plain li without assuming card structure', () => {
		const ul = document.createElement('ul');
		ul.innerHTML = '<li data-testid="search-list-first-ad"><iframe title="ad"></iframe></li>';
		document.body.append(ul);
		const li = ul.querySelector('li')!;
		const before = li.outerHTML;
		const btn = ensurePill(li, false, () => {});
		expect(li.firstElementChild!.localName).toBe(PILL_TAG);
		expect(li.children[1]!.localName).toBe('iframe');
		expect(btn.firstChild!.textContent).toBe('Sponsored — show');
		removePill(li);
		expect(li.outerHTML).toBe(before);
	});

	it('mounts on a bare article too', () => {
		const article = document.createElement('article');
		article.setAttribute('data-testid', 'property-card');
		document.body.append(article);
		ensurePill(article, false, () => {});
		expect(article.firstElementChild!.localName).toBe(PILL_TAG);
	});
});

describe('removePill', () => {
	it('restores the item byte-for-byte', () => {
		const li = mountCard();
		const before = li.outerHTML;
		ensurePill(li, false, () => {});
		expect(li.outerHTML).not.toBe(before);
		removePill(li);
		expect(li.outerHTML).toBe(before);
		expect(li.querySelector(PILL_TAG)).toBeNull();
	});

	it('is a no-op on an item without a pill', () => {
		const li = mountCard();
		const before = li.outerHTML;
		removePill(li);
		expect(li.outerHTML).toBe(before);
	});

	it('pillButton returns null for unknown elements', () => {
		expect(pillButton(document.createElement('div'))).toBeNull();
	});
});
