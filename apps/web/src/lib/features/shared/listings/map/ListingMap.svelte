<script lang="ts">
	// The listing map (06-19, RENT-02; 06-RESEARCH Pattern 2, 06-UI-SPEC "Map contract").
	//
	// This is the ONLY component that loads Leaflet. It is itself reached only through LazyMap's
	// dynamic import, so Leaflet, supercluster and leaflet.css ship in a chunk that the List tab and
	// marketing pages never download. Leaflet is imported inside onMount because its module top
	// level reads window/navigator/document and would crash prerender.
	//
	// SECURITY: no listing text ever reaches a Leaflet HTML string. Pins/clusters are DOM nodes
	// built with textContent (pins.ts); names go through `title` and setAttribute. No popups.
	//
	// OSM tile policy (live mode only): the single https://tile.openstreetmap.org host, the
	// document's default Referer (no referrer option), visible attribution, Leaflet's default
	// buffering only. Sample mode has no tile layer at all: zero third-party requests.
	import 'leaflet/dist/leaflet.css';
	import { onMount } from 'svelte';
	import type * as Leaflet from 'leaflet';
	import type { Listing } from '@tran/core/listings';
	import { createClusterIndex, MAP_MAX_ZOOM } from './cluster';
	import {
		buildClusterElement,
		buildPinElement,
		clusterLabel,
		pinLabel,
		pinText,
		pinWidth
	} from './pins';

	type LeafletNS = typeof import('leaflet');

	interface Props {
		rows: readonly Listing[];
		newIds?: ReadonlySet<string>;
		selectedId?: string | null;
		highlightedId?: string | null;
		mode: 'sample' | 'live';
		/** Changes only on a new location search: the view refits then, never on a filter change. */
		fitKey: string;
		/** False while the Map tab's panel is hidden; going true re-measures the map. */
		active?: boolean;
		onselect?: (id: string) => void;
		onspot?: (rows: Listing[]) => void;
		onhover?: (id: string | null) => void;
		onready?: (count: number) => void;
	}

	let {
		rows,
		newIds = new Set<string>(),
		selectedId = null,
		highlightedId = null,
		mode,
		fitKey,
		active = true,
		onselect,
		onspot,
		onhover,
		onready
	}: Props = $props();

	/** Single-result and maximum fit zoom (UI-SPEC "Viewport behaviour"). */
	const FIT_ZOOM = 15;
	/** Contiguous US, used only when no result has coordinates. */
	const US_CENTER: [number, number] = [39.8, -98.6];
	const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
	// Static string: no listing data. Leaflet renders attribution as markup.
	const OSM_ATTRIBUTION =
		'<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>';

	let el = $state<HTMLDivElement | null>(null);
	let L: LeafletNS | undefined;
	let map: Leaflet.Map | undefined;
	let layer: Leaflet.LayerGroup | undefined;
	/** Markers on screen, keyed so unchanged pins survive a redraw (focus stays on them). */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- imperative Leaflet bookkeeping, never rendered
	let markers = new Map<string, { marker: Leaflet.Marker; id: string | null }>();
	let ready = $state(false);
	let fittedKey: string | null = null;
	let motionOK = false;

	const index = $derived(createClusterIndex(rows));
	const byId = $derived(new Map(rows.map((r) => [r.id, r])));

	function bbox(m: Leaflet.Map): [number, number, number, number] {
		const b = m.getBounds();
		return [
			Math.max(-180, b.getWest()),
			Math.max(-85, b.getSouth()),
			Math.min(180, b.getEast()),
			Math.min(85, b.getNorth())
		];
	}

	function fit(): void {
		if (!map || !L) return;
		const pts = rows.filter(
			(r) =>
				typeof r.latitude === 'number' &&
				Number.isFinite(r.latitude) &&
				typeof r.longitude === 'number' &&
				Number.isFinite(r.longitude)
		);
		if (pts.length === 0) {
			map.setView(US_CENTER, 4, { animate: false });
			return;
		}
		if (pts.length === 1) {
			map.setView([pts[0]!.latitude!, pts[0]!.longitude!], FIT_ZOOM, { animate: motionOK });
			return;
		}
		const bounds = L.latLngBounds(pts.map((r) => [r.latitude!, r.longitude!] as [number, number]));
		map.fitBounds(bounds, { padding: [32, 32], maxZoom: FIT_ZOOM, animate: motionOK });
	}

	/** Enter/Space activate a marker element (Leaflet 1.9 only maps Enter to popups). */
	function onKeys(element: HTMLElement | undefined, activate: () => void): void {
		element?.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.stopPropagation();
				activate();
			}
		});
	}

	function nameElement(marker: Leaflet.Marker, label: string): void {
		const node = marker.getElement();
		if (!node) return;
		node.setAttribute('role', 'button');
		node.setAttribute('aria-label', label);
		node.tabIndex = 0;
	}

	function clusterMarker(
		lib: LeafletNS,
		latlng: [number, number],
		clusterId: number,
		count: number
	): Leaflet.Marker {
		const label = clusterLabel(count);
		const marker = lib.marker(latlng, {
			icon: lib.divIcon({
				html: buildClusterElement(document, count),
				className: 'tran-cluster',
				iconSize: [40, 40]
			}),
			title: label,
			keyboard: true,
			riseOnHover: false
		});
		const activate = () => {
			if (!map) return;
			const zoom = index.getClusterExpansionZoom(clusterId);
			if (zoom > map.getMaxZoom()) {
				const leaves = index
					.getLeaves(clusterId, Infinity)
					.map((f) => byId.get(f.properties.id))
					.filter((r): r is Listing => r !== undefined);
				onspot?.(leaves);
				return;
			}
			map.setView(latlng, zoom, { animate: motionOK });
			// The cluster is replaced by what it held: keep keyboard focus on the map.
			el?.focus({ preventScroll: true });
		};
		marker.on('click', activate);
		marker.on('add', () => {
			nameElement(marker, label);
			onKeys(marker.getElement(), activate);
		});
		return marker;
	}

	function pinMarker(lib: LeafletNS, latlng: [number, number], row: Listing): Leaflet.Marker {
		const isNew = newIds.has(row.id);
		const text = pinText(row.price);
		const width = pinWidth(text) + (isNew ? 20 : 0);
		const label = pinLabel(row, isNew);
		const marker = lib.marker(latlng, {
			icon: lib.divIcon({
				html: buildPinElement(document, text, { isNew }),
				className: 'tran-pin-icon',
				iconSize: [width, 28],
				iconAnchor: [width / 2, 14]
			}),
			title: label,
			keyboard: true,
			riseOnHover: false
		});
		const activate = () => onselect?.(row.id);
		marker.on('click', activate);
		marker.on('add', () => {
			nameElement(marker, label);
			const node = marker.getElement();
			onKeys(node, activate);
			node?.addEventListener('focus', () => onhover?.(row.id));
			node?.addEventListener('blur', () => onhover?.(null));
			node?.addEventListener('pointerenter', (e) => {
				if (e.pointerType === 'mouse') onhover?.(row.id);
			});
			node?.addEventListener('pointerleave', (e) => {
				if (e.pointerType === 'mouse') onhover?.(null);
			});
		});
		return marker;
	}

	/** Re-renders the markers for the current viewport. Pure: never touches a gateway. */
	function draw(): void {
		const lib = L;
		if (!map || !lib || !layer) return;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- imperative Leaflet bookkeeping, never rendered
		const next = new Map<string, { marker: Leaflet.Marker; id: string | null }>();
		for (const f of index.getClusters(bbox(map), Math.round(map.getZoom()))) {
			const [lng, lat] = f.geometry.coordinates as [number, number];
			const props = f.properties as Record<string, unknown>;
			if (props.cluster === true) {
				const clusterId = props.cluster_id as number;
				const count = props.point_count as number;
				const key = `c:${clusterId}:${count}`;
				next.set(
					key,
					markers.get(key) ?? { marker: clusterMarker(lib, [lat, lng], clusterId, count), id: null }
				);
			} else {
				const row = byId.get(props.id as string);
				if (!row) continue;
				const key = `p:${row.id}:${newIds.has(row.id) ? 1 : 0}:${lat},${lng}`;
				next.set(key, markers.get(key) ?? { marker: pinMarker(lib, [lat, lng], row), id: row.id });
			}
		}
		for (const [key, entry] of markers) if (!next.has(key)) layer.removeLayer(entry.marker);
		for (const [key, entry] of next) if (!markers.has(key)) entry.marker.addTo(layer);
		markers = next;
		restyle();
	}

	/** Selection/highlight are class + z-index changes on existing pins (instant, no redraw). */
	function restyle(): void {
		for (const { marker, id } of markers.values()) {
			if (id === null) continue;
			const node = marker.getElement();
			const selected = id === selectedId;
			node?.classList.toggle('tran-pin-selected', selected);
			node?.classList.toggle('tran-pin-highlighted', !selected && id === highlightedId);
			marker.setZIndexOffset(selected ? 1000 : 0);
		}
	}

	/** Re-measures after the hidden Map panel is shown again (Pitfall 14). */
	export function invalidateSize(): void {
		map?.invalidateSize({ pan: false });
	}

	onMount(() => {
		let disposed = false;
		motionOK = matchMedia('(prefers-reduced-motion: no-preference)').matches;
		(async () => {
			const lib = await import('leaflet');
			if (disposed || !el) return;
			L = lib;
			const m = lib.map(el, {
				maxZoom: MAP_MAX_ZOOM,
				scrollWheelZoom: false,
				zoomAnimation: motionOK,
				fadeAnimation: motionOK,
				markerZoomAnimation: motionOK
			});
			map = m;
			m.attributionControl.setPrefix('Leaflet');
			if (mode === 'live') {
				// Leaflet 1.9.4 points unloaded/removed tiles at a data: GIF to cancel them, which the
				// img-src CSP refuses (a violation on every pan). Removing the src cancels the request
				// the same way, with no data: URI. Overrides private methods of the pinned 1.9.4.
				type TileRecord = { el: HTMLImageElement; coords: { z: number } };
				type TileInternals = {
					_tiles: Record<string, TileRecord>;
					_tileZoom: number;
					fire: (type: string, data: unknown) => void;
				};
				const grid = lib.GridLayer.prototype as unknown as {
					_removeTile: (this: unknown, key: string) => void;
				};
				const CspSafeTileLayer = lib.TileLayer.extend({
					_removeTile(this: TileInternals, key: string) {
						const tile = this._tiles[key];
						if (!tile) return;
						tile.el.removeAttribute('src');
						return grid._removeTile.call(this, key);
					},
					_abortLoading(this: TileInternals) {
						for (const key of Object.keys(this._tiles)) {
							const tile = this._tiles[key]!;
							if (tile.coords.z === this._tileZoom) continue;
							const img = tile.el;
							img.onload = null;
							img.onerror = null;
							if (!img.complete) {
								img.removeAttribute('src');
								img.remove();
								delete this._tiles[key];
								this.fire('tileabort', { tile: img, coords: tile.coords });
							}
						}
					}
				}) as unknown as typeof Leaflet.TileLayer;
				new CspSafeTileLayer(TILE_URL, {
					maxZoom: MAP_MAX_ZOOM,
					attribution: OSM_ATTRIBUTION
				}).addTo(m);
			}
			layer = lib.layerGroup().addTo(m);
			fit();
			fittedKey = rows.length > 0 ? fitKey : null;
			m.on('moveend', draw);
			// Wheel zoom only once the user has engaged with the map (UI-SPEC: no scroll hijack).
			el.addEventListener('click', () => m.scrollWheelZoom.enable());
			el.addEventListener('focusin', () => m.scrollWheelZoom.enable());
			el.addEventListener('focusout', (e) => {
				if (!el?.contains(e.relatedTarget as Node | null)) m.scrollWheelZoom.disable();
			});
			draw();
			ready = true;
			onready?.(rows.length);
		})();
		return () => {
			disposed = true;
			map?.remove();
			map = undefined;
			layer = undefined;
			markers.clear();
		};
	});

	// Rows / new-ids changes redraw pins locally; the view refits only for a new location search
	// (or the first time results arrive after the map opened empty).
	$effect(() => {
		void index;
		void newIds;
		if (!ready) return;
		if (rows.length > 0 && fitKey !== fittedKey) {
			fittedKey = fitKey;
			fit();
		}
		draw();
	});

	$effect(() => {
		void selectedId;
		void highlightedId;
		if (ready) restyle();
	});

	$effect(() => {
		if (active && ready) requestAnimationFrame(() => invalidateSize());
	});
</script>

<div
	bind:this={el}
	data-listing-map={mode}
	class="tran-map w-full rounded-lg border border-border {mode === 'sample'
		? 'tran-map-sample'
		: ''}"
></div>

<style>
	/* An explicit height in the component itself: Leaflet must never measure a 0px box. */
	:global(.tran-map) {
		height: clamp(320px, 60dvh, 480px);
	}
	:global(.tran-map.leaflet-container) {
		font-family: inherit;
		background-color: var(--color-surface);
	}
	:global(.tran-map.leaflet-container:focus-visible) {
		outline: 2px solid var(--color-ring);
		outline-offset: 2px;
	}
	/* Sample mode: a plain decorative grid instead of street tiles. */
	:global(.tran-map.tran-map-sample.leaflet-container) {
		background-color: var(--color-surface);
		background-image:
			linear-gradient(var(--color-border) 1px, transparent 1px),
			linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
		background-size: 64px 64px;
	}

	/* Rent pins: the Leaflet icon div is the 28px-tall button; the span is its face. */
	:global(.tran-pin-icon) {
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	:global(.tran-pin-icon:focus-visible),
	:global(.tran-cluster:focus-visible) {
		outline: 2px solid var(--color-ring);
		outline-offset: 2px;
	}
	:global(.tran-pin) {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: 100%;
		height: 28px;
		padding: 0 8px;
		border: 1px solid var(--color-foreground);
		border-radius: var(--radius-full);
		background-color: var(--color-card);
		color: var(--color-foreground);
		box-shadow: var(--shadow-card);
		font-size: 14px;
		line-height: 1;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	:global(.tran-pin-new) {
		background-color: var(--color-accent-surface);
	}
	:global(.tran-pin-bell) {
		flex: none;
	}
	:global(.tran-pin-icon.tran-pin-highlighted .tran-pin),
	:global(.tran-pin-icon:focus-visible .tran-pin) {
		border-width: 2px;
	}
	:global(.tran-pin-icon.tran-pin-selected .tran-pin) {
		background-color: var(--color-foreground);
		color: var(--color-card);
		box-shadow:
			inset 0 0 0 2px var(--color-card),
			var(--shadow-card);
	}

	/* Clusters: 40px circles with the count. */
	:global(.tran-cluster) {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--color-foreground);
		border-radius: var(--radius-full);
		background-color: var(--color-card);
		color: var(--color-foreground);
		box-shadow: var(--shadow-card);
		cursor: pointer;
	}
	:global(.tran-cluster-count) {
		font-size: 14px;
		line-height: 1;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* Zoom buttons: 44x44 targets. */
	:global(.tran-map .leaflet-bar) {
		border: none;
		box-shadow: var(--shadow-card);
	}
	:global(.tran-map .leaflet-bar a),
	:global(.tran-map .leaflet-bar a:hover) {
		box-sizing: border-box;
		width: 44px;
		height: 44px;
		line-height: 42px;
		font-size: 22px;
		color: var(--color-foreground);
		background-color: var(--color-card);
		border: 1px solid var(--color-input);
	}
	:global(.tran-map .leaflet-bar a:focus-visible) {
		outline: 2px solid var(--color-ring);
		outline-offset: 2px;
	}

	/* Attribution: opaque, readable, never hidden (OSM policy). */
	:global(.tran-map .leaflet-control-attribution) {
		padding: 4px 8px;
		font-size: 14px;
		line-height: 1.4;
		color: var(--color-foreground);
		background-color: var(--color-card);
	}
	:global(.tran-map .leaflet-control-attribution a) {
		color: var(--color-foreground);
		text-decoration: underline;
	}
</style>
