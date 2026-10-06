// Which rentals sit inside the current map view (06-21, RENT-02; 06-UI-SPEC split view: "the
// split view's list column follows the map").
//
// Pure on purpose: no Leaflet import (06-05 lint boundary). ListingMap hands its bounds over as
// plain numbers. Every edge is inclusive, so a pin drawn exactly on the edge of the view is also
// in the list. Antimeridian-crossing views are out of scope (the US map never wraps).

export interface MapBounds {
	west: number;
	south: number;
	east: number;
	north: number;
}

interface Located {
	latitude?: number | null;
	longitude?: number | null;
}

const finite = (n: number | null | undefined): n is number =>
	typeof n === 'number' && Number.isFinite(n);

/** Rows whose coordinates fall inside `b` (edges inclusive), in input order. */
export function rowsInBounds<T extends Located>(rows: readonly T[], b: MapBounds): T[] {
	return rows.filter(
		(r) =>
			finite(r.latitude) &&
			finite(r.longitude) &&
			r.latitude >= b.south &&
			r.latitude <= b.north &&
			r.longitude >= b.west &&
			r.longitude <= b.east
	);
}
