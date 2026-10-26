/**
 * Hand-written synthetic fixtures that approximate the structure of a listing-results page.
 * They are NOT copied markup: only the stable hook attribute names from selectors.v1.json
 * appear, all text is fictional, and nothing references a URL (happy-dom must stay offline).
 * The `id` on each list item is test-only lookup glue; the detector never reads ids.
 */

export interface Fixture {
	name: string;
	html: string;
	dimmed: readonly string[];
	clean: readonly string[];
}

const card = (id: string, badges: readonly string[], body: string): string => `
		<li id="${id}" data-c11n-component="List.Item">
			<article data-testid="property-card" data-c11n-component="PropertyCard.Root">
				${
					badges.length
						? `<div data-c11n-component="PropertyCard.BadgeArea">${badges
								.map((b) => `<span data-c11n-component="PropertyCard.Badge">${b}</span>`)
								.join('')}</div>`
						: ''
				}
				${body}
			</article>
		</li>`;

const listing = (address: string, price: string): string =>
	`<div><span>${price}</span><address>${address}</address></div>`;

export const fixtureA: Fixture = {
	name: 'A: rentals grid with badges',
	html: `<div id="grid-search-results"><ul>
		${card('a-1', ['Featured'], listing('12 Example Lane, Springfield', '$1,234/mo'))}
		${card('a-2', ['Sponsored'], listing('48 Sample Court, Springfield', '$1,450/mo'))}
		${card('a-3', ['Showcase'], listing('7 Placeholder Row, Springfield', '$2,100/mo'))}
		${card('a-4', ['Gas fireplace'], listing('301 Fiction Avenue, Springfield', '$1,875/mo'))}
		${card('a-5', ['Special Offer'], listing('19 Mockup Street, Springfield', '$1,320/mo'))}
		${card('a-6', [], `<p>Featured amenities</p>${listing('5 Demo Drive, Springfield', '$1,600/mo')}`)}
		${card('a-7', ['PROMOTED ·'], listing('88 Invented Way, Springfield', '$1,990/mo'))}
	</ul></div>`,
	dimmed: ['a-1', 'a-2', 'a-7'],
	clean: ['a-3', 'a-4', 'a-5', 'a-6']
};

/** Content an ad slot receives once its unit "loads" (late-fill tests). */
export const adSlotFill = '<div><span>New homes nearby</span></div>';

export const fixtureB: Fixture = {
	name: 'B: for-sale list with ad slots',
	html: `<div id="grid-search-results"><ul>
		${card('b-1', [], listing('210 Example Lane, Shelbyville', '$412,000'))}
		${card('b-2', [], `<p>Address</p>${listing('14 Sample Court, Shelbyville', '$389,500')}`)}
		<li id="b-3" data-testid="search-list-first-ad">
			<div><p>Loading...<svg aria-hidden="true"></svg></p></div>
		</li>
		${card('b-4', ['Modern finishes'], listing('66 Fiction Avenue, Shelbyville', '$455,000'))}
		${card('b-5', [], listing('3 Placeholder Row, Shelbyville', '$299,900'))}
		<li id="b-6" data-testid="search-list-second-ad"><div>Promoted community</div></li>
		<li id="b-7" data-testid="search-list-third-ad"><div><iframe></iframe></div></li>
	</ul></div>`,
	dimmed: ['b-3', 'b-6', 'b-7'],
	clean: ['b-1', 'b-2', 'b-4', 'b-5']
};

const plain = (id: string, inner: string): string =>
	`<li id="${id}"><div>${inner}<p>9 Example Lane, Springfield</p></div></li>`;

export const fixtureC: Fixture = {
	name: 'C: label-only generic list (no card attributes)',
	html: `<div id="search-page-list-container"><ul>
		${plain('c-1', '<span>Sponsored</span>')}
		${plain('c-2', '<span>sponsored listing:</span>')}
		${plain('c-3', '<span>Ad</span>')}
		${plain('c-4', '<span>Ad-free building</span>')}
		${plain('c-5', '<span>Sponsored by the owner, see details inside this listing</span>')}
	</ul></div>`,
	dimmed: ['c-1', 'c-2', 'c-3'],
	clean: ['c-4', 'c-5']
};

export const fixtureD: Fixture = {
	name: 'D: aria-label, title and alt badges',
	html: `<div id="grid-search-results"><ul>
		${card('d-1', [], `<span aria-label="Sponsored listing"></span>${listing('1 Example Lane, Ogdenville', '$1,100/mo')}`)}
		${card('d-2', [], `<img alt="Promoted">${listing('2 Sample Court, Ogdenville', '$1,200/mo')}`)}
		${card('d-3', [], `<div title="Featured listing">${listing('3 Fiction Avenue, Ogdenville', '$1,300/mo')}</div>`)}
		${card('d-4', [], `<button type="button" aria-label="Save this home"></button>${listing('4 Demo Drive, Ogdenville', '$1,400/mo')}`)}
		${card('d-5', [], `<span aria-label="Sponsored listing: more homes from this builder in your area"></span>${listing('5 Mockup Street, Ogdenville', '$1,500/mo')}`)}
	</ul></div>`,
	dimmed: ['d-1', 'd-2', 'd-3'],
	clean: ['d-4', 'd-5']
};

export const FIXTURES = [fixtureA, fixtureB, fixtureC, fixtureD] as const;

/** Replace the document body with `html` and return its first element (the fixture root). */
export function mount(doc: Document, html: string): Element {
	doc.body.innerHTML = html;
	const root = doc.body.firstElementChild;
	if (!root) throw new Error('fixture html produced no element');
	return root;
}
