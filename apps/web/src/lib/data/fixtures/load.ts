import type { FixtureSet } from './fixture-fetch';

/**
 * Loads the six fixture files by dynamic import so they land in their own chunk and only
 * sample mode pulls them (marketing routes never import $lib/data).
 */
export async function loadFixtureSet(): Promise<FixtureSet> {
	const [meta, metros, rentals, sales, estimates, markets] = await Promise.all([
		import('./meta.json'),
		import('./metros.json'),
		import('./rentals.json'),
		import('./sales.json'),
		import('./estimates.json'),
		import('./markets.json')
	]);
	return {
		meta: meta.default,
		metros: metros.default,
		rentals: rentals.default,
		sales: sales.default,
		estimates: estimates.default,
		markets: markets.default
	} as unknown as FixtureSet;
}
