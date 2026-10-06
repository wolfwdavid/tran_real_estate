// Clustering config (06-19, RENT-02). These values are the spike-verified axe target-size fix
// (06-RESEARCH Pitfall 9): changing any of them must fail a test here.
import { describe, expect, test } from 'vitest';
import { CLUSTER_OPTIONS, createClusterIndex, MAP_MAX_ZOOM, toPointFeatures } from './cluster';

type Row = { id: string; latitude: number | null; longitude: number | null };

const at = (id: string, latitude: number | null, longitude: number | null): Row => ({
	id,
	latitude,
	longitude
});

const WORLD: [number, number, number, number] = [-180, -85, 180, 85];

describe('CLUSTER_OPTIONS', () => {
	test('exact axe-verified values', () => {
		expect(CLUSTER_OPTIONS).toEqual({ radius: 48, extent: 256, maxZoom: 19 });
		expect(MAP_MAX_ZOOM).toBe(18);
	});

	test('supercluster maxZoom is above the map maxZoom, so co-located units always cluster', () => {
		expect(CLUSTER_OPTIONS.maxZoom).toBeGreaterThan(MAP_MAX_ZOOM);
	});
});

describe('toPointFeatures', () => {
	test('skips rows without finite coordinates and keeps the id', () => {
		const rows = [
			at('a', 36.1, -95.9),
			at('b', null, -95.9),
			at('c', 36.1, null),
			at('d', Number.NaN, -95.9),
			at('e', 36.2, Number.POSITIVE_INFINITY),
			at('f', 0, 0)
		];
		const features = toPointFeatures(rows);
		expect(features.map((f) => f.properties.id)).toEqual(['a', 'f']);
		expect(features[0]?.geometry.coordinates).toEqual([-95.9, 36.1]);
	});
});

describe('createClusterIndex', () => {
	test('index carries the exact options', () => {
		const index = createClusterIndex([at('a', 36.1, -95.9)]);
		expect(index.options).toMatchObject(CLUSTER_OPTIONS);
	});

	test('five units at one spot stay one cluster at the map max zoom and cannot expand within it', () => {
		const rows = ['1', '2', '3', '4', '5'].map((n) => at(`u${n}`, 36.15, -95.99));
		const index = createClusterIndex(rows);
		const clusters = index.getClusters(WORLD, MAP_MAX_ZOOM);
		expect(clusters).toHaveLength(1);
		const [only] = clusters;
		expect(only?.properties).toMatchObject({ cluster: true, point_count: 5 });
		const id = (only?.properties as { cluster_id: number }).cluster_id;
		expect(index.getClusterExpansionZoom(id)).toBeGreaterThan(MAP_MAX_ZOOM);
		expect(index.getLeaves(id, Infinity).map((f) => f.properties.id)).toHaveLength(5);
	});

	test('points about 40px apart at zoom 14 cluster; far apart they do not', () => {
		// At zoom 14 one 256px tile spans 360/2^14 deg; 40px is about 0.0034 deg of longitude.
		const near = createClusterIndex([at('a', 36.15, -95.99), at('b', 36.15, -95.99 + 0.0034)]);
		expect(near.getClusters(WORLD, 14)).toHaveLength(1);
		// 60px apart (beyond the 48px radius) stay separate.
		const far = createClusterIndex([at('a', 36.15, -95.99), at('b', 36.15, -95.99 + 0.0052)]);
		expect(far.getClusters(WORLD, 14)).toHaveLength(2);
	});
});
