import {
	type Category,
	type FilterConfig,
	type OptInCategory,
	MAX_ATTR_LEN,
	MAX_TEXT_LEN,
	PILL_TAG,
	normalizeLabel
} from './config';

/**
 * Pure, label-first detection of paid placements in a results list.
 *
 * Reads only short label text and short aria-label/title/alt values, plus the bundled
 * hook selectors. It never reads ids, links, image sources, prices or page JSON: the
 * extension identifies sponsored cards, it does not extract listing data.
 */

export type HitCategory = Category | OptInCategory;
export interface Hit {
	category: HitCategory;
	via: 'ad-slot' | 'label' | 'attribute';
}
export interface ClassifyOptions {
	optIn?: readonly OptInCategory[];
}

const LABEL_ATTRS = ['aria-label', 'title', 'alt'] as const;
const IGNORED_SUBTREES = `${PILL_TAG}, script, style, noscript, template`;

/** First configured results container, in config order. Never `<body>` or `<html>`. */
export function findContainer(root: ParentNode, cfg: FilterConfig): Element | null {
	for (const selector of cfg.resultsContainers) {
		for (const el of root.querySelectorAll(selector)) {
			if (el.localName !== 'body' && el.localName !== 'html') return el;
		}
	}
	return null;
}

const byDocumentOrder = (a: Element, b: Element): number =>
	a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

/** Outermost result items (list items and ad slots, else card roots), deduplicated, in order. */
export function itemsIn(container: Element, cfg: FilterConfig): Element[] {
	const collect = (selectors: readonly string[]): Set<Element> => {
		const found = new Set<Element>();
		for (const selector of selectors) {
			for (const el of container.querySelectorAll(selector)) found.add(el);
		}
		return found;
	};

	let found = collect([...cfg.itemRoots, ...cfg.adSlots]);
	if (found.size === 0) found = collect(cfg.cardRoots);

	const outermost = [...found].filter((el) => {
		for (let p = el.parentElement; p && p !== container; p = p.parentElement) {
			if (found.has(p)) return false;
		}
		return true;
	});
	return outermost.sort(byDocumentOrder);
}

const isAdSlot = (item: Element, cfg: FilterConfig): boolean =>
	cfg.adSlots.some((selector) => item.matches(selector) || item.querySelector(selector) !== null);

function vocabulary(
	cfg: FilterConfig,
	opts: ClassifyOptions | undefined
): Map<string, HitCategory> {
	const map = new Map<string, HitCategory>();
	for (const [category, labels] of Object.entries(cfg.labels) as [Category, readonly string[]][]) {
		for (const label of labels) map.set(normalizeLabel(label), category);
	}
	for (const category of opts?.optIn ?? []) {
		for (const label of cfg.optInLabels[category] ?? []) map.set(normalizeLabel(label), category);
	}
	return map;
}

/** True when `el` sits in an ignored subtree (reveal pill, script, style) inside `item`. */
function isIgnored(el: Element, item: Element): boolean {
	const ignored = el.closest(IGNORED_SUBTREES);
	return ignored !== null && item.contains(ignored);
}

function labelHit(item: Element, labels: Map<string, HitCategory>): HitCategory | undefined {
	const doc = item.ownerDocument;
	const walker = doc.createTreeWalker(item, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const parent = node.parentElement;
		if (!parent || isIgnored(parent, item)) continue;
		const text = (node.nodeValue ?? '').trim();
		if (text.length === 0 || text.length > MAX_TEXT_LEN) continue;
		const category = labels.get(normalizeLabel(text));
		if (category) return category;
	}
	return undefined;
}

function attributeHit(item: Element, labels: Map<string, HitCategory>): HitCategory | undefined {
	const selector = LABEL_ATTRS.map((name) => `[${name}]`).join(',');
	for (const el of item.querySelectorAll(selector)) {
		if (isIgnored(el, item)) continue;
		for (const name of LABEL_ATTRS) {
			const value = el.getAttribute(name);
			if (value === null || value.length > MAX_ATTR_LEN) continue;
			const category = labels.get(normalizeLabel(value));
			if (category) return category;
		}
	}
	return undefined;
}

/**
 * Classify one result item. Order: ad slot (label-independent), then exact short text
 * labels, then exact short aria-label/title/alt values. Exact match only, never substring.
 */
export function classify(item: Element, cfg: FilterConfig, opts?: ClassifyOptions): Hit | null {
	if (isAdSlot(item, cfg)) return { category: 'ad', via: 'ad-slot' };

	const labels = vocabulary(cfg, opts);
	const byLabel = labelHit(item, labels);
	if (byLabel) return { category: byLabel, via: 'label' };

	const byAttribute = attributeHit(item, labels);
	if (byAttribute) return { category: byAttribute, via: 'attribute' };

	return null;
}
