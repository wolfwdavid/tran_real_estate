import { canonicalParams, type DataRequest } from './canonical.js';

/** Every RentCast endpoint Tran calls. The id is also the canonical-key prefix. */
export type EndpointId =
	| 'rental-listings'
	| 'sale-listings'
	| 'rental-listing-by-id'
	| 'rent-estimate'
	| 'value-estimate'
	| 'markets';

export const ENDPOINT_PATHS: Record<EndpointId, string> = {
	'rental-listings': '/v1/listings/rental/long-term',
	'sale-listings': '/v1/listings/sale',
	'rental-listing-by-id': '/v1/listings/rental/long-term/{id}',
	'rent-estimate': '/v1/avm/rent/long-term',
	'value-estimate': '/v1/avm/value',
	markets: '/v1/markets'
};

/**
 * The wire request for a DataRequest. The query is built from the same canonicalParams()
 * that builds the cache key, so the key and the URL cannot drift.
 * Path placeholders (`{id}`) are substituted percent-encoded and removed from the query.
 */
export function requestTarget(req: DataRequest): { path: string; query: [string, string][] } {
	const template = ENDPOINT_PATHS[req.endpoint];
	const query = canonicalParams(req.params);
	if (!template.includes('{id}')) return { path: template, query };

	const id = query.find(([k]) => k === 'id')?.[1];
	if (id === undefined) throw new TypeError(`${req.endpoint} requires an id param`);
	return {
		path: template.replace('{id}', encodeURIComponent(id)),
		query: query.filter(([k]) => k !== 'id')
	};
}
