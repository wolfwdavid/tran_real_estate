// Rent pins and cluster bubbles for the listing map (06-19, RENT-02; 06-UI-SPEC "Map contract").
//
// SECURITY: Never interpolate listing data into Leaflet HTML strings (divIcon html, popups and
// attribution are parsed as markup). Pin and cluster content is built here as DOM nodes and every piece
// of text goes in through textContent. Accessible names go through Leaflet's `title` option and
// setAttribute, which never parse markup.
import { formatRent } from '@tran/core/renter';
import type { Listing } from '@tran/core/listings';

/** The listing fields a pin needs. `price` may be missing on hand-built rows. */
export type PinRow = Pick<Listing, 'formattedAddress' | 'addressLine1' | 'bedrooms'> &
	Pick<Partial<Listing>, 'addressLine2'> & { price: number | null | undefined };

const NO_RENT = 'Rent not listed';

/** "$2,150" (compact rent on the pin), or "Rent not listed". */
export function pinText(price: number | null | undefined): string {
	return formatRent(price) ?? NO_RENT;
}

/** "418 Larkspur Ln, Unit 5": line 1 (+ line 2), else formattedAddress before the city. */
function street(row: PinRow): string {
	const line1 = row.addressLine1?.trim() || row.formattedAddress.split(',')[0]?.trim() || '';
	const line2 = row.addressLine2?.trim();
	return line2 ? `${line1}, ${line2}` : line1;
}

function bedroomsText(n: number | null | undefined): string | null {
	if (n === null || n === undefined || !Number.isFinite(n)) return null;
	if (n === 0) return 'studio';
	return n === 1 ? '1 bedroom' : `${n} bedrooms`;
}

/** "{$rent} a month, {street line}, {n} bedrooms", prefixed "New. " when new since last visit. */
export function pinLabel(row: PinRow, isNew: boolean): string {
	const rent = formatRent(row.price);
	const parts = [rent ? `${rent} a month` : NO_RENT, street(row), bedroomsText(row.bedrooms)];
	const label = parts.filter((p): p is string => Boolean(p)).join(', ');
	return isNew ? `New. ${label}` : label;
}

/** The street line used in the selection announcement. */
export function pinStreet(row: PinRow): string {
	return street(row);
}

export function clusterLabel(count: number): string {
	return `${count} rentals here. Zoom in to see them.`;
}

export function spotTitle(count: number): string {
	return `${count} rentals at this spot`;
}

/** Pin width in px: at least 44 (target size), grows with the text, snapped to the 4px grid. */
export function pinWidth(text: string): number {
	return Math.max(44, Math.ceil((16 + text.length * 8.5) / 4) * 4);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Lucide BellDot (14px), decorative: the non-color cue for "new since last visit". */
function bellDot(doc: Document): SVGSVGElement {
	const svg = doc.createElementNS(SVG_NS, 'svg');
	for (const [k, v] of [
		['width', '14'],
		['height', '14'],
		['viewBox', '0 0 24 24'],
		['fill', 'none'],
		['stroke', 'currentColor'],
		['stroke-width', '2'],
		['stroke-linecap', 'round'],
		['stroke-linejoin', 'round'],
		['aria-hidden', 'true'],
		['focusable', 'false'],
		['class', 'tran-pin-bell']
	]) {
		svg.setAttribute(k, v);
	}
	const path = (d: string) => {
		const p = doc.createElementNS(SVG_NS, 'path');
		p.setAttribute('d', d);
		svg.appendChild(p);
	};
	path('M10.268 21a2 2 0 0 0 3.464 0');
	path(
		'M13.916 2.314A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.74 7.327A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673 9 9 0 0 1-.585-.665'
	);
	const dot = doc.createElementNS(SVG_NS, 'circle');
	for (const [k, v] of [
		['cx', '18'],
		['cy', '8'],
		['r', '3']
	]) {
		dot.setAttribute(k, v);
	}
	svg.appendChild(dot);
	return svg;
}

/** The pin body: span.tran-pin with the rent as text (and a BellDot when new). */
export function buildPinElement(
	doc: Document,
	text: string,
	opts: { isNew: boolean }
): HTMLElement {
	const pin = doc.createElement('span');
	pin.className = opts.isNew ? 'tran-pin tran-pin-new' : 'tran-pin';
	if (opts.isNew) pin.appendChild(bellDot(doc));
	const label = doc.createElement('span');
	label.textContent = text;
	pin.appendChild(label);
	return pin;
}

/** The cluster bubble: span.tran-cluster-count with the count as text. */
export function buildClusterElement(doc: Document, count: number): HTMLElement {
	const el = doc.createElement('span');
	el.className = 'tran-cluster-count';
	el.textContent = String(count);
	return el;
}
