import { afterEach, describe, expect, test } from 'vitest';
import { CONFIG, PILL_TAG } from '../src/lib/config';
import { classify, findContainer, itemsIn } from '../src/lib/detect';
import { adSlotFill, fixtureA, fixtureB, fixtureD, mount } from './fixtures/cards';

afterEach(() => {
	document.body.innerHTML = '';
});

const byId = (id: string): Element => {
	const el = document.getElementById(id);
	if (!el) throw new Error(`missing #${id}`);
	return el;
};

/** A one-item list whose card holds `inner`, returned as the item element. */
const item = (inner: string): Element =>
	mount(
		document,
		`<div id="grid-search-results"><ul><li id="x" data-c11n-component="List.Item"><article data-testid="property-card">${inner}</article></li></ul></div>`
	).querySelector('#x') as Element;

describe('classify: ad slots', () => {
	test('an empty or loading ad slot is an ad regardless of label', () => {
		mount(document, fixtureB.html);
		expect(classify(byId('b-3'), CONFIG)).toEqual({ category: 'ad', via: 'ad-slot' });
		expect(classify(byId('b-7'), CONFIG)).toEqual({ category: 'ad', via: 'ad-slot' });
	});

	test('an ad slot stays an ad after it is filled late', () => {
		mount(document, fixtureB.html);
		const slot = byId('b-3');
		slot.innerHTML = adSlotFill;
		expect(classify(slot, CONFIG)).toEqual({ category: 'ad', via: 'ad-slot' });
	});

	test('a wrapper that contains an ad slot is classified as an ad', () => {
		const el = item('<div data-testid="search-list-first-ad"></div>');
		expect(classify(el, CONFIG)).toEqual({ category: 'ad', via: 'ad-slot' });
	});
});

describe('classify: labels and attributes', () => {
	test('badge text maps to its category via label', () => {
		mount(document, fixtureA.html);
		expect(classify(byId('a-1'), CONFIG)).toEqual({ category: 'featured', via: 'label' });
		expect(classify(byId('a-2'), CONFIG)).toEqual({ category: 'sponsored', via: 'label' });
		expect(classify(byId('a-7'), CONFIG)).toEqual({ category: 'promoted', via: 'label' });
	});

	test('aria-label, alt and title map via attribute', () => {
		mount(document, fixtureD.html);
		expect(classify(byId('d-1'), CONFIG)).toEqual({ category: 'sponsored', via: 'attribute' });
		expect(classify(byId('d-2'), CONFIG)).toEqual({ category: 'promoted', via: 'attribute' });
		expect(classify(byId('d-3'), CONFIG)).toEqual({ category: 'featured', via: 'attribute' });
		expect(classify(byId('d-4'), CONFIG)).toBeNull();
		expect(classify(byId('d-5'), CONFIG)).toBeNull();
	});

	test('Showcase is null by default and detected only when opted in', () => {
		mount(document, fixtureA.html);
		expect(classify(byId('a-3'), CONFIG)).toBeNull();
		expect(classify(byId('a-3'), CONFIG, { optIn: [] })).toBeNull();
		expect(classify(byId('a-3'), CONFIG, { optIn: ['showcase'] })).toEqual({
			category: 'showcase',
			via: 'label'
		});
	});

	test('matching is exact, never substring', () => {
		expect(classify(item('<span>Sponsored homes near you</span>'), CONFIG)).toBeNull();
		expect(classify(item('<span>Ad</span>'), CONFIG)).toEqual({ category: 'ad', via: 'label' });
		expect(classify(item('<span>Address</span>'), CONFIG)).toBeNull();
		expect(classify(item('<span>Featured amenities</span>'), CONFIG)).toBeNull();
		expect(classify(item('<span>Ad-free building</span>'), CONFIG)).toBeNull();
		expect(classify(item('<span>Gas fireplace</span>'), CONFIG)).toBeNull();
	});

	test('a label inside a text node longer than MAX_TEXT_LEN is ignored', () => {
		const text = 'sponsored'.padEnd(40, ' x');
		expect(text.length).toBe(40);
		expect(classify(item(`<span>${text}</span>`), CONFIG)).toBeNull();
	});

	test('case and trailing punctuation are normalized', () => {
		expect(classify(item('<span>  ADVERTISEMENT: </span>'), CONFIG)?.category).toBe('ad');
		expect(classify(item('<span>Featured Listing —</span>'), CONFIG)?.category).toBe('featured');
	});

	test('text and attributes in the reveal pill, script and style are ignored', () => {
		const pill = item(`<${PILL_TAG}>Sponsored</${PILL_TAG}><p>12 Example Lane</p>`);
		expect(classify(pill, CONFIG)).toBeNull();
		const attr = item(`<${PILL_TAG} aria-label="Sponsored"><span title="Ad"></span></${PILL_TAG}>`);
		expect(classify(attr, CONFIG)).toBeNull();
		expect(classify(item('<style>ad</style>'), CONFIG)).toBeNull();
	});

	test('an organic card with no label is null', () => {
		expect(
			classify(item('<p>$1,234/mo</p><p>12 Example Lane, Springfield</p>'), CONFIG)
		).toBeNull();
	});
});

describe('itemsIn', () => {
	test('returns outermost items only, deduplicated, in document order', () => {
		const root = mount(document, fixtureA.html);
		const items = itemsIn(root, CONFIG);
		expect(items.map((el) => el.id)).toEqual(['a-1', 'a-2', 'a-3', 'a-4', 'a-5', 'a-6', 'a-7']);
		expect(items.every((el) => el.tagName === 'LI')).toBe(true);
		expect(new Set(items).size).toBe(items.length);
	});

	test('includes ad-slot items alongside cards', () => {
		const root = mount(document, fixtureB.html);
		expect(itemsIn(root, CONFIG).map((el) => el.id)).toEqual([
			'b-1',
			'b-2',
			'b-3',
			'b-4',
			'b-5',
			'b-6',
			'b-7'
		]);
	});

	test('falls back to card roots when no item roots match', () => {
		const root = mount(
			document,
			`<div id="grid-search-results"><div>
				<article id="k-1" data-testid="property-card"><span>Sponsored</span></article>
				<article id="k-2" data-testid="property-card" data-c11n-component="PropertyCard.Root"></article>
			</div></div>`
		);
		expect(itemsIn(root, CONFIG).map((el) => el.id)).toEqual(['k-1', 'k-2']);
	});

	test('returns an empty list for an empty container', () => {
		const root = mount(document, '<div id="grid-search-results"></div>');
		expect(itemsIn(root, CONFIG)).toEqual([]);
	});
});

describe('findContainer', () => {
	test('returns null on an empty document', () => {
		expect(findContainer(document, CONFIG)).toBeNull();
	});

	test('returns the first configured container in order', () => {
		mount(
			document,
			'<main><div id="search-page-list-container"></div><div id="grid-search-results"></div></main>'
		);
		expect(findContainer(document, CONFIG)?.id).toBe('grid-search-results');
	});

	test('never returns body or html, even if they carry a container hook', () => {
		document.body.id = 'grid-search-results';
		try {
			expect(findContainer(document, CONFIG)).toBeNull();
		} finally {
			document.body.removeAttribute('id');
		}
	});
});
