// The frozen Market Snapshot record (STU-04, 09-RESEARCH Pattern 7). Built once at save time from
// data already loaded, so saving spends 0 RentCast calls and the print route never reads the
// expiring response cache.
//
// Pure and data-layer free: no $lib/data import, no network, no Dexie. The record carries only the
// 14 SNAPSHOT_RECORD_KEYS: computed metrics, the Phase 7 chart inputs, the aggregate-only listings
// summary, the reviewed narrative, the options, provenance, a copy of the disclosure fields and the
// effective brand colors. Never a raw response, a listing field or the logo bytes (`hasLogo` only).
import type { ProfileInput } from '@tran/core/agent/types';
import type { MarketStats } from '@tran/core/listings';
import { buildSnapshotMetrics, type AggregatedSample } from '@tran/core/studio';
import { effectiveBrandColors, toDisclosureProfile } from '$lib/features/shared/agent-profile';
import { toMarketStatsInput } from '$lib/features/shared/markets/market-input';
import type {
	SnapshotNarrative,
	SnapshotOptions,
	SnapshotRecord,
	SnapshotSeries
} from '$lib/storage/studio/types';

export interface BuildSnapshotArgs {
	id: string;
	/** ISO timestamp of the save (createdAt). */
	now: string;
	zip: string;
	placeName: string | null;
	/** The Phase 4 DOMAIN stats (snapshot-data loadZipData). */
	stats: MarketStats;
	fetchedAt: string;
	source: 'rentcast' | 'sample';
	listings: { sample: AggregatedSample; fetchedAt: string } | null;
	narrative: SnapshotNarrative | null;
	options: SnapshotOptions;
	/** The saved agent profile (AgentProfile is assignable) or the sample agent. */
	profile: ProfileInput;
	sample: boolean;
}

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const v of Object.values(value)) deepFreeze(v);
	}
	return value;
}

/** Chart inputs: the trend needs the rental side; price-to-rent needs both sides. */
function seriesOf(stats: MarketStats): SnapshotSeries {
	const input = toMarketStatsInput(stats);
	return {
		rentTrend: stats.rental ? input : null,
		priceToRent: stats.rental && stats.sale ? input : null
	};
}

/** Rebuilt key by key, so only the whitelisted aggregate fields can reach the record. */
function copySample(s: AggregatedSample): AggregatedSample {
	return {
		kind: s.kind,
		seenAt: s.seenAt,
		total: s.total,
		byBedroom: s.byBedroom.map((r) => ({
			beds: r.beds,
			count: r.count,
			min: r.min,
			max: r.max,
			median: r.median,
			medianDom: r.medianDom
		}))
	};
}

export function buildSnapshotRecord(args: BuildSnapshotArgs): SnapshotRecord {
	const colors = effectiveBrandColors(args.profile);
	const n = args.narrative;
	const record: SnapshotRecord = {
		id: args.id,
		zip: args.zip,
		placeName: args.placeName,
		createdAt: args.now,
		sample: args.sample,
		source: args.source,
		fetchedAt: args.fetchedAt,
		metrics: buildSnapshotMetrics(args.stats),
		series: seriesOf(args.stats),
		listingsSample: args.listings ? copySample(args.listings.sample) : null,
		listingsFetchedAt: args.listings ? args.listings.fetchedAt : null,
		narrative: n
			? {
					text: n.text,
					artifactId: n.artifactId,
					provider: n.provider,
					model: n.model,
					sampleOutput: n.sampleOutput
				}
			: null,
		options: {
			eho: args.options.eho,
			tranFooter: args.options.tranFooter,
			sections: [...args.options.sections]
		},
		agent: {
			disclosure: toDisclosureProfile(args.profile),
			brandPrimary: colors.primary,
			brandAccent: colors.accent,
			hasLogo: args.profile.logo != null
		}
	};
	return deepFreeze(record);
}
