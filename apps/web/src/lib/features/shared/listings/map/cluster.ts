// Supercluster index for the listing map (06-19, RENT-02).
//
// The values are the spike-verified fix for axe `target-size` (06-RESEARCH Pitfall 9) and supersede
// UI-SPEC's radius 60 / maxZoom 16: extent 256 matches Leaflet's tile size, radius 48 keeps 28px
// pins and 40px clusters from overlapping, and supercluster maxZoom 19 > map maxZoom 18 means
// units sharing one coordinate always render as a cluster, never as stacked pins.
import Supercluster from 'supercluster';
import type { PointFeature } from 'supercluster';

export const CLUSTER_OPTIONS = { radius: 48, extent: 256, maxZoom: 19 } as const;
/** Map and tile max zoom (below CLUSTER_OPTIONS.maxZoom on purpose). */
export const MAP_MAX_ZOOM = 18;

export interface MapPointProps {
	id: string;
}

type Locatable = { id: string; latitude: number | null; longitude: number | null };

const finite = (n: number | null): n is number => typeof n === 'number' && Number.isFinite(n);

/** GeoJSON points ([lng, lat]) for rows with finite coordinates; others are skipped. */
export function toPointFeatures(rows: readonly Locatable[]): PointFeature<MapPointProps>[] {
	const out: PointFeature<MapPointProps>[] = [];
	for (const r of rows) {
		if (!finite(r.latitude) || !finite(r.longitude)) continue;
		out.push({
			type: 'Feature',
			properties: { id: r.id },
			geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] }
		});
	}
	return out;
}

export type ClusterIndex = Supercluster<MapPointProps>;

export function createClusterIndex(rows: readonly Locatable[]): ClusterIndex {
	return new Supercluster<MapPointProps>({ ...CLUSTER_OPTIONS }).load(toPointFeatures(rows));
}
