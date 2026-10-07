// The frozen Market Snapshot record and the built-in sample report (STU-04). Saving is pure: no
// request of any kind, only the 14 record keys, no listing field, logo or raw response anywhere,
// and the effective brand colors fall back to Tran's when the agent's choice fails contrast.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkFairHousing } from '@tran/core/fair-housing';
import {
	buildSnapshotMetrics,
	snapshotAllowedNumbers,
	type AggregatedSample
} from '@tran/core/studio';
import type { ProfileInput } from '@tran/core/agent/types';
import { studioSnapshotV1 } from '$lib/ai/prompts/studio/snapshot.v1';
import { numberPostCheck, numberWordsPostCheck } from '$lib/features/studio/post-checks';
import {
	effectiveBrandColors,
	SAMPLE_AGENT_PROFILE,
	toDisclosureProfile
} from '$lib/features/shared/agent-profile';
import { toMarketStatsInput } from '$lib/features/shared/markets/market-input';
import {
	FORBIDDEN_SNAPSHOT_KEYS,
	SNAPSHOT_RECORD_KEYS,
	snapshotViolations
} from '$lib/storage/studio/tables';
import { SNAPSHOT_SECTION_KEYS } from '$lib/storage/studio/types';
import {
	SAMPLE_FETCHED_AT,
	SAMPLE_LISTINGS_SUMMARY,
	SAMPLE_MARKET_STATS,
	SAMPLE_SNAPSHOT_RECORD
} from '../fixtures/sample-snapshot';
import { buildSnapshotRecord, type BuildSnapshotArgs } from './build-record';

const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const NOW = '2026-10-07T12:00:00.000Z';

const LISTINGS: AggregatedSample = {
	kind: 'rental',
	seenAt: NOW,
	total: 3,
	byBedroom: [{ beds: 2, count: 3, min: 1500, max: 1700, median: 1600, medianDom: 12 }]
};

function args(over: Partial<BuildSnapshotArgs> = {}): BuildSnapshotArgs {
	return {
		id: ID,
		now: NOW,
		zip: SAMPLE_MARKET_STATS.zipCode,
		placeName: null,
		stats: SAMPLE_MARKET_STATS,
		fetchedAt: '2026-10-06T08:00:00.000Z',
		source: 'rentcast',
		listings: { sample: LISTINGS, fetchedAt: NOW },
		narrative: {
			text: 'Median rent is $1,615.',
			artifactId: null,
			provider: 'anthropic',
			model: 'claude-sonnet-5',
			sampleOutput: false
		},
		options: { eho: true, tranFooter: false, sections: ['keyFigures', 'rentTrend'] },
		profile: { ...SAMPLE_AGENT_PROFILE, brandPrimary: '#1F4E79', brandAccent: '#E8F0F8' },
		sample: false,
		...over
	};
}

/** Every key at every depth of a JSON value. */
function allKeys(v: unknown, out: string[] = []): string[] {
	if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
	else if (v !== null && typeof v === 'object') {
		for (const [k, x] of Object.entries(v)) {
			out.push(k);
			allKeys(x, out);
		}
	}
	return out;
}

const LISTING_FIELDS = [
	...FORBIDDEN_SNAPSHOT_KEYS,
	'id',
	'price',
	'latitude',
	'longitude',
	'listingType',
	'daysOnMarket'
];

afterEach(() => vi.unstubAllGlobals());

describe('buildSnapshotRecord', () => {
	it('derives metrics and chart series from the same stats with core and the Phase 7 mapper', () => {
		const r = buildSnapshotRecord(args());
		expect(r.metrics).toEqual(buildSnapshotMetrics(SAMPLE_MARKET_STATS));
		expect(r.series.rentTrend).toEqual(toMarketStatsInput(SAMPLE_MARKET_STATS));
		expect(r.series.priceToRent).toEqual(toMarketStatsInput(SAMPLE_MARKET_STATS));
		expect(r.listingsSample).toEqual(LISTINGS);
		expect(r.listingsFetchedAt).toBe(NOW);
		expect(r.createdAt).toBe(NOW);
		expect(r.fetchedAt).toBe('2026-10-06T08:00:00.000Z');
		expect(r.source).toBe('rentcast');
	});

	it('drops a chart whose side is missing', () => {
		const r = buildSnapshotRecord(args({ stats: { ...SAMPLE_MARKET_STATS, sale: null } }));
		expect(r.series.rentTrend).not.toBeNull();
		expect(r.series.priceToRent).toBeNull();
		const noRent = buildSnapshotRecord(args({ stats: { ...SAMPLE_MARKET_STATS, rental: null } }));
		expect(noRent.series.rentTrend).toBeNull();
		expect(noRent.series.priceToRent).toBeNull();
	});

	it('copies the disclosure fields and the effective brand colors, never the logo', () => {
		const profile: ProfileInput = {
			...SAMPLE_AGENT_PROFILE,
			brandPrimary: '#1F4E79',
			brandAccent: '#E8F0F8',
			logo: { base64: 'AAAA', mime: 'image/png', width: 1, height: 1, bytes: 3 }
		};
		const r = buildSnapshotRecord(args({ profile }));
		const colors = effectiveBrandColors(profile);
		expect(r.agent.disclosure).toEqual(toDisclosureProfile(profile));
		expect(r.agent.brandPrimary).toBe(colors.primary);
		expect(r.agent.brandAccent).toBe(colors.accent);
		expect(r.agent.hasLogo).toBe(true);
		expect(JSON.stringify(r)).not.toContain('AAAA');
		expect(allKeys(r)).not.toContain('logo');
	});

	it('falls back to the Tran colors (#A4452A / #F6E3D8) when the chosen colors fail', () => {
		const r = buildSnapshotRecord(
			args({
				profile: { ...SAMPLE_AGENT_PROFILE, brandPrimary: '#FFFF00', brandAccent: '#000000' }
			})
		);
		expect(r.agent.brandPrimary).toBe('#a4452a');
		expect(r.agent.brandAccent).toBe('#f6e3d8');
		const unset = buildSnapshotRecord(args({ profile: SAMPLE_AGENT_PROFILE }));
		expect(unset.agent.brandPrimary).toBe('#a4452a');
		expect(unset.agent.hasLogo).toBe(false);
	});

	it('holds only the record keys and no listing field, logo, raw or response at any depth', () => {
		const leaky = {
			...LISTINGS,
			formattedAddress: '1 Example Way',
			byBedroom: [{ ...LISTINGS.byBedroom[0], listingAgent: { name: 'x' } }]
		} as unknown as AggregatedSample;
		const r = buildSnapshotRecord(args({ listings: { sample: leaky, fetchedAt: NOW } }));
		expect(Object.keys(r).sort()).toEqual([...SNAPSHOT_RECORD_KEYS].sort());
		const keys = allKeys(JSON.parse(JSON.stringify(r)));
		for (const k of LISTING_FIELDS) expect(keys).not.toContain(k === 'id' ? 'listingId' : k);
		expect(keys.filter((k) => k === 'id')).toEqual(['id']);
		expect(snapshotViolations(r)).toEqual([]);
	});

	it('is deeply frozen and spends nothing: no request, no promise', () => {
		const globalFetch = vi.fn();
		vi.stubGlobal('fetch', globalFetch);
		const r = buildSnapshotRecord(args());
		expect(r).not.toBeInstanceOf(Promise);
		expect(Object.isFrozen(r)).toBe(true);
		expect(Object.isFrozen(r.metrics)).toBe(true);
		expect(Object.isFrozen(r.options.sections)).toBe(true);
		expect(Object.isFrozen(r.agent.disclosure)).toBe(true);
		expect(() => {
			(r as { zip: string }).zip = '00000';
		}).toThrow();
		expect(globalFetch).not.toHaveBeenCalled();
	});

	it('does not alias the caller options or narrative', () => {
		const a = args();
		const r = buildSnapshotRecord(a);
		a.options.sections.push('marketNotes');
		expect(r.options.sections).toEqual(['keyFigures', 'rentTrend']);
		expect(r.narrative).toEqual(a.narrative);
		expect(r.narrative).not.toBe(a.narrative);
	});
});

describe('SAMPLE_SNAPSHOT_RECORD', () => {
	const r = SAMPLE_SNAPSHOT_RECORD;
	const asOf = SAMPLE_FETCHED_AT;

	it('is the sample report for the sample agent', () => {
		expect(r.id).toBe('sample');
		expect(r.sample).toBe(true);
		expect(r.source).toBe('sample');
		expect(r.zip).toBe('74201');
		expect(r.placeName).toBe('Harlow Springs, OK');
		expect(r.agent.disclosure.fullName).toBe('Avery Sample');
		expect(r.agent.disclosure.brokerage).toBe('Sample Realty');
		expect(r.options).toEqual({
			eho: true,
			tranFooter: true,
			sections: [...SNAPSHOT_SECTION_KEYS]
		});
		expect(r.options.sections).toHaveLength(6);
		expect(r.listingsSample).toEqual(SAMPLE_LISTINGS_SUMMARY);
		expect(r.listingsSample?.kind).toBe('sale');
		expect(snapshotViolations(r)).toEqual([]);
	});

	it('uses core metrics and the keyless sample notes', () => {
		expect(r.metrics).toEqual(buildSnapshotMetrics(SAMPLE_MARKET_STATS));
		expect(r.metrics.months).toBe(24);
		expect(r.metrics.medianRent).toBe(1615);
		expect(r.metrics.saleDom).toBe(35);
		expect(r.metrics.rentByBedroom.map((b) => b.beds)).toEqual([0, 1, 2, 3, 4]);
		expect(r.narrative?.sampleOutput).toBe(true);
		expect(r.narrative?.text).toBe(
			studioSnapshotV1.sample!({ metrics: r.metrics, sample: r.listingsSample, asOf })
		);
		expect(r.narrative?.text.length).toBeGreaterThan(0);
	});

	it('the sample notes pass the snapshot number checks and the Fair Housing checker', () => {
		const text = r.narrative!.text;
		const allowed = snapshotAllowedNumbers(r.metrics, r.listingsSample, asOf);
		for (const check of [numberPostCheck('snapshot', allowed), numberWordsPostCheck()]) {
			expect(check(text)).toEqual([]);
		}
		expect(checkFairHousing(text)).toEqual([]);
	});
});
