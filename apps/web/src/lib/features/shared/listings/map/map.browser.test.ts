// Real-browser coverage for the listing map (06-19, RENT-02): DOM-built pins, names, keyboard
// activation, co-located clusters and axe (including target-size). Sample mode only, so no tile
// request can leave the test (the no-network setup would fail it).
import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Listing } from '@tran/core/listings';
import { axeViolations } from '$lib/testing/axe';
import ListingMap from './ListingMap.svelte';
import { buildClusterElement, buildPinElement } from './pins';

function listing(overrides: Partial<Listing> = {}): Listing {
	return {
		id: 'SAMPLE-1',
		kind: 'rental',
		formattedAddress: '12 Fictional Ln, Harlow Springs, OK 74201',
		addressLine1: '12 Fictional Ln',
		addressLine2: null,
		city: 'Harlow Springs',
		state: 'OK',
		zipCode: '74201',
		latitude: 36.15,
		longitude: -95.99,
		propertyType: 'Condo',
		bedrooms: 2,
		bathrooms: 1.5,
		squareFootage: 1050,
		yearBuilt: 1998,
		hoaFee: null,
		price: 1650,
		status: 'Active',
		listingType: null,
		listedDate: '2026-09-28T00:00:00.000Z',
		removedDate: null,
		lastSeenDate: '2026-10-02T00:00:00.000Z',
		daysOnMarket: 7,
		mlsName: null,
		mlsNumber: null,
		agent: null,
		office: null,
		history: [],
		...overrides
	};
}

const pins = (root: Element) =>
	[...root.querySelectorAll<HTMLElement>('.leaflet-marker-icon')].filter((n) =>
		n.classList.contains('tran-pin-icon')
	);
const clusters = (root: Element) =>
	[...root.querySelectorAll<HTMLElement>('.leaflet-marker-icon')].filter((n) =>
		n.classList.contains('tran-cluster')
	);

describe('pin builders (browser)', () => {
	test('markup-looking listing text stays text', () => {
		const pin = buildPinElement(document, '<img src=x onerror=alert(1)>', { isNew: true });
		expect(pin.querySelector('img')).toBeNull();
		expect(pin.textContent).toBe('<img src=x onerror=alert(1)>');
		expect(pin.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
		expect(buildClusterElement(document, 12).textContent).toBe('12');
	});
});

describe('ListingMap (browser)', () => {
	test('spread rows render named, focusable pins; Enter selects; axe clean', async () => {
		const rows = [
			listing({ id: 'a', latitude: 36.15, longitude: -95.99, price: 1650 }),
			listing({
				id: 'b',
				latitude: 36.17,
				longitude: -95.93,
				price: 2150,
				addressLine1: '418 Larkspur Ln',
				bedrooms: 0
			}),
			listing({ id: 'c', latitude: 36.11, longitude: -95.95, price: 980, addressLine1: '<b>x</b>' })
		];
		const onselect = vi.fn();
		const onready = vi.fn();
		const { container } = await render(ListingMap, {
			props: {
				rows,
				newIds: new Set(['b']),
				mode: 'sample',
				fitKey: 'k',
				onselect,
				onready
			}
		});
		await vi.waitFor(() => expect(onready).toHaveBeenCalledWith(3));
		await vi.waitFor(() => expect(pins(container).length + clusters(container).length).toBe(3));
		const labels = pins(container).map((p) => p.getAttribute('aria-label'));
		expect(labels).toContain('New. $2,150 a month, 418 Larkspur Ln, studio');
		expect(labels).toContain('$980 a month, <b>x</b>, 2 bedrooms');
		expect(container.querySelector('b')).toBeNull();
		for (const p of pins(container)) {
			expect(p.getAttribute('role')).toBe('button');
			expect(p.tabIndex).toBe(0);
		}
		// Sample mode: no tile layer, the backdrop class, no tile <img>.
		expect(container.querySelector('.leaflet-tile')).toBeNull();
		expect(container.querySelector('.tran-map-sample')).not.toBeNull();

		const target = pins(container).find((p) => p.getAttribute('aria-label')?.includes('$1,650'));
		target!.focus();
		target!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(onselect).toHaveBeenCalledWith('a');
		target!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(onselect).toHaveBeenCalledTimes(2);

		expect(await axeViolations(container)).toEqual([]);
	});

	test('units at one spot form a named cluster that lists them instead of zooming', async () => {
		const rows = ['1', '2', '3', '4', '5'].map((n) => listing({ id: `u${n}` }));
		const onspot = vi.fn();
		const onready = vi.fn();
		const { container } = await render(ListingMap, {
			props: { rows, mode: 'sample', fitKey: 'k', onspot, onready }
		});
		await vi.waitFor(() => expect(onready).toHaveBeenCalled());
		await vi.waitFor(() => expect(clusters(container)).toHaveLength(1));
		expect(pins(container)).toHaveLength(0);
		const cluster = clusters(container)[0]!;
		expect(cluster.getAttribute('aria-label')).toBe('5 rentals here. Zoom in to see them.');
		expect(cluster.getAttribute('role')).toBe('button');
		cluster.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(onspot).toHaveBeenCalledTimes(1);
		expect(onspot.mock.calls[0]![0].map((r: Listing) => r.id).sort()).toEqual([
			'u1',
			'u2',
			'u3',
			'u4',
			'u5'
		]);
		expect(await axeViolations(container)).toEqual([]);
	});

	test('selection restyles the existing pin without replacing it (focus survives)', async () => {
		const rows = [
			listing({ id: 'a', latitude: 36.15, longitude: -95.99 }),
			listing({ id: 'b', latitude: 36.19, longitude: -95.9 })
		];
		const onready = vi.fn();
		const screen = await render(ListingMap, {
			props: { rows, mode: 'sample', fitKey: 'k', onready, selectedId: null }
		});
		await vi.waitFor(() => expect(pins(screen.container)).toHaveLength(2));
		const first = pins(screen.container)[0]!;
		first.focus();
		const id = first.getAttribute('aria-label')!;
		await screen.rerender({ rows, mode: 'sample', fitKey: 'k', onready, selectedId: 'a' });
		await vi.waitFor(() =>
			expect(screen.container.querySelector('.tran-pin-selected')).not.toBeNull()
		);
		expect(document.activeElement?.getAttribute('aria-label')).toBe(id);
	});
});
