// Content Studio storage types (Phase 9, STU-01 / STU-04). Dependency-free at runtime (type
// imports plus two constant tuples), so routes, builders and the print view can import them
// without pulling in Dexie.
//
// A SnapshotRecord is FROZEN at save time (09-RESEARCH Pattern 7): the print route renders it with
// zero RentCast calls and never reads the expiring response cache. It holds computed metrics, the
// chart inputs, the aggregate-only listings summary, the reviewed narrative, the options, the
// provenance and a copy of the disclosure fields. It never holds a raw RentCast response, a
// listing address or the logo bytes (the logo is referenced from the agent profile: `hasLogo`).
import type { MarketStatsInput } from '@tran/core/markets';
import type { AggregatedSample, DisclosureProfile, SnapshotMetrics } from '@tran/core/studio';

/** The four studio tools; each autosaves one working form. */
export const STUDIO_TOOLS = ['listing', 'social', 'reel', 'snapshot'] as const;
export type StudioTool = (typeof STUDIO_TOOLS)[number];

/** One tool's autosaved form ("Studio forms" in the backup). `data` is the form's plain value. */
export interface StudioDraftRecord {
	tool: StudioTool;
	data: unknown;
	/** ISO timestamp of the last write. */
	updatedAt: string;
}

/** The report sections a snapshot can include, in report order. */
export const SNAPSHOT_SECTION_KEYS = [
	'keyFigures',
	'rentTrend',
	'priceToRent',
	'rentByBedroom',
	'domInventory',
	'marketNotes'
] as const;
export type SnapshotSectionKey = (typeof SNAPSHOT_SECTION_KEYS)[number];

/** The reviewed market notes as saved. `artifactId` links the Phase 5 AI draft when there is one. */
export interface SnapshotNarrative {
	text: string;
	artifactId: string | null;
	provider: string | null;
	model: string | null;
	sampleOutput: boolean;
}

export interface SnapshotOptions {
	eho: boolean;
	tranFooter: boolean;
	sections: SnapshotSectionKey[];
}

/** The agent at save time: disclosure fields and effective colors. The logo stays in the profile. */
export interface SnapshotAgent {
	disclosure: DisclosureProfile;
	brandPrimary: string;
	brandAccent: string;
	hasLogo: boolean;
}

/** Chart inputs: exactly the `stats` prop of the Phase 7 ZipTrendChart / PriceToRentChart. */
export interface SnapshotSeries {
	rentTrend: MarketStatsInput | null;
	priceToRent: MarketStatsInput | null;
}

export interface SnapshotRecord {
	/** uuid for saved records; the 09-14 sample record uses 'sample' and is never stored. */
	id: string;
	zip: string;
	placeName: string | null;
	createdAt: string;
	sample: boolean;
	source: 'rentcast' | 'sample';
	/** When the market statistics were fetched (provenance). */
	fetchedAt: string;
	metrics: SnapshotMetrics;
	series: SnapshotSeries;
	listingsSample: AggregatedSample | null;
	listingsFetchedAt: string | null;
	narrative: SnapshotNarrative | null;
	options: SnapshotOptions;
	agent: SnapshotAgent;
}
