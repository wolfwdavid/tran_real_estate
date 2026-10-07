// Market Snapshot save gate and the saved-snapshots list (09-17). The gate is a pure table test;
// SnapshotList renders in svelte/server (no $effect, no Dexie), and its helpers are tested directly.
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import type { Finding } from '@tran/core/fair-housing';
import type { SnapshotRecord } from '$lib/storage/studio/types';
import { SAMPLE_SNAPSHOT_RECORD } from '../fixtures/sample-snapshot';
import {
	choicesData,
	defaultInclude,
	notesSummary,
	parseChoices,
	spendText,
	missingLabels,
	notesGateFields,
	saveGateReason,
	type SaveGateState
} from './save-gate';
import SnapshotList, {
	deletedAnnouncement,
	deleteTitle,
	EMPTY_LINE,
	focusTargetAfterDelete,
	snapshotRowLine
} from './SnapshotList.svelte';

const DOT = String.fromCharCode(0xb7);

const CLEAR: SaveGateState = {
	hasData: true,
	dataSections: 5,
	notesOn: true,
	notesStatus: 'ready',
	mustFix: 0,
	unackedReview: false,
	profileMissing: [],
	live: true
};

const R = {
	noData: "Load a ZIP code's data first.",
	noSection: 'Choose at least one section with market data.',
	notes: 'Draft the market notes, or turn them off in step 2.',
	fix: (n: number) =>
		`Fix the ${n} items marked Must fix in the market notes, and review any others.`,
	profile: 'Add your full name, license number in your profile so your disclosure can be added.'
};

describe('saveGateReason', () => {
	test.each<[string, Partial<SaveGateState>, string | null]>([
		['all clear', {}, null],
		['no ZIP data', { hasData: false }, R.noData],
		['no data section', { dataSections: 0 }, R.noSection],
		['notes not drafted', { notesStatus: 'none' }, R.notes],
		['notes streaming', { notesStatus: 'streaming' }, R.notes],
		['must-fix findings', { mustFix: 2 }, R.fix(2)],
		['unacknowledged review only', { unackedReview: true }, R.fix(0)],
		[
			'live data, incomplete profile',
			{ profileMissing: ['full name', 'license number'] },
			R.profile
		],
		['sample data, incomplete profile', { live: false, profileMissing: ['full name'] }, null],
		['notes off: draft state ignored', { notesOn: false, notesStatus: 'none', mustFix: 3 }, null]
	])('%s', (_name, patch, expected) => {
		expect(saveGateReason({ ...CLEAR, ...patch })).toBe(expected);
	});

	test('priority order holds when several reasons apply', () => {
		const all: SaveGateState = {
			hasData: false,
			dataSections: 0,
			notesOn: true,
			notesStatus: 'none',
			mustFix: 1,
			unackedReview: true,
			profileMissing: ['brokerage'],
			live: true
		};
		expect(saveGateReason(all)).toBe(R.noData);
		expect(saveGateReason({ ...all, hasData: true })).toBe(R.noSection);
		expect(saveGateReason({ ...all, hasData: true, dataSections: 1 })).toBe(R.notes);
		expect(saveGateReason({ ...all, hasData: true, dataSections: 1, notesStatus: 'ready' })).toBe(
			R.fix(1)
		);
		expect(
			saveGateReason({
				...all,
				hasData: true,
				dataSections: 1,
				notesStatus: 'ready',
				mustFix: 0,
				unackedReview: false
			})
		).toBe('Add your brokerage in your profile so your disclosure can be added.');
	});

	test('missing fields use the UI-SPEC names joined with commas', () => {
		expect(missingLabels(['fullName', 'licenseType', 'brokeragePhone'])).toEqual([
			'full name',
			'license type',
			'brokerage phone'
		]);
	});
});

const finding = (severity: 'block' | 'warn'): Finding =>
	({ id: severity, start: 0, end: 1, severity, members: [] }) as unknown as Finding;

describe('notesGateFields (the panel bindables)', () => {
	test('no draft, streaming, ready, findings', () => {
		expect(notesGateFields({ draftText: '', canExit: false, findings: [] }).notesStatus).toBe(
			'none'
		);
		expect(notesGateFields({ draftText: 'Rent', canExit: false, findings: [] }).notesStatus).toBe(
			'streaming'
		);
		expect(notesGateFields({ draftText: 'Rent', canExit: true, findings: [] })).toEqual({
			notesStatus: 'ready',
			mustFix: 0,
			unackedReview: false
		});
		expect(
			notesGateFields({
				draftText: 'Rent',
				canExit: false,
				findings: [finding('block'), finding('warn')]
			})
		).toEqual({ notesStatus: 'ready', mustFix: 1, unackedReview: false });
		expect(
			notesGateFields({ draftText: 'Rent', canExit: false, findings: [finding('warn')] })
		).toEqual({ notesStatus: 'ready', mustFix: 0, unackedReview: true });
		// Acknowledged review findings: the panel allows exits.
		expect(
			notesGateFields({ draftText: 'Rent', canExit: true, findings: [finding('warn')] })
				.unackedReview
		).toBe(false);
	});
});

describe('builder helpers', () => {
	test('step 4 cost and notes values', () => {
		expect(spendText('network')).toBe('1 call');
		expect(spendText('cached')).toBe(`0 calls ${DOT} cached`);
		expect(spendText('sample')).toBe(`0 calls ${DOT} sample data`);
		expect(notesSummary(false, true)).toBe('Not included');
		expect(notesSummary(true, true)).toBe('Drafted');
		expect(notesSummary(true, false)).toBe('Not drafted yet');
	});

	test('the autosaved choices round-trip and never carry market data', () => {
		const include = { ...defaultInclude(), eho: false, listingsKind: 'rental' as const };
		const data = choicesData('00199', include);
		expect(Object.keys(data).sort()).toEqual(
			['eho', 'listingsKind', 'sections', 'tranFooter', 'zip'].sort()
		);
		expect(parseChoices(structuredClone(data))).toEqual({ zip: '00199', include });
		expect(parseChoices(null)).toBeNull();
		expect(parseChoices({ zip: '00199' })).toBeNull();
		expect(
			parseChoices({ ...data, zip: 'abc', sections: ['keyFigures', 'bogus'], listingsKind: 'x' })
		).toEqual({
			zip: null,
			include: { ...include, sections: ['keyFigures'], listingsKind: null }
		});
	});
});

const strip = (h: string) => h.replace(/<!--[\s\S]*?-->/g, '');
const textOf = (h: string) =>
	strip(h)
		.replace(/<[^>]+>/g, ' ')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();

const rec = (patch: Partial<SnapshotRecord>): SnapshotRecord => ({
	...structuredClone(SAMPLE_SNAPSHOT_RECORD),
	...patch
});

const OLDER = rec({
	id: '11111111-1111-4111-8111-111111111111',
	zip: '74201',
	createdAt: '2026-10-02T15:00:00.000Z',
	fetchedAt: '2026-10-01T12:00:00.000Z',
	sample: true
});
const NEWER = rec({
	id: '22222222-2222-4222-8222-222222222222',
	zip: '00199',
	placeName: null,
	createdAt: '2026-10-05T15:00:00.000Z',
	fetchedAt: '2026-10-04T12:00:00.000Z',
	sample: false,
	options: { eho: true, tranFooter: true, sections: ['keyFigures', 'rentTrend'] }
});

const noop = () => undefined;

describe('SnapshotList (SSR)', () => {
	test('no records: the empty line and the sample report link', () => {
		const body = strip(render(SnapshotList, { props: { records: [], onDeleted: noop } }).body);
		expect(textOf(body)).toContain('Your snapshots');
		expect(textOf(body)).toContain(EMPTY_LINE);
		expect(EMPTY_LINE).toBe('No saved snapshots yet. Build one above, or look at a sample first.');
		const link = /<a href="([^"]+)"[^>]*>Preview a sample report<\/a>/.exec(body);
		expect(link?.[1]).toMatch(/\/print\/snapshot\/\?id=sample$/);
	});

	test('two records render newest first with the row line, chip and print link', () => {
		const body = strip(
			render(SnapshotList, { props: { records: [NEWER, OLDER], onDeleted: noop } }).body
		);
		const text = textOf(body);
		expect(text.indexOf('ZIP 00199')).toBeGreaterThan(-1);
		expect(text.indexOf('ZIP 00199')).toBeLessThan(text.indexOf('ZIP 74201'));
		expect(text).toContain(`Saved Oct 5, 2026 ${DOT} data as of Oct 4, 2026 ${DOT} 2 sections`);
		expect(text).toContain(
			`Saved Oct 2, 2026 ${DOT} data as of Oct 1, 2026 ${DOT} ${OLDER.options.sections.length} sections`
		);
		const rows = body.split('data-snapshot-row=').slice(1);
		expect(rows).toHaveLength(2);
		expect(rows[0]).not.toContain('Sample data');
		expect(rows[1]).toContain('Sample data');
		const hrefs = [...body.matchAll(/<a href="([^"]+)"[^>]*>Open print view/g)].map((m) => m[1]);
		expect(hrefs[0]).toMatch(new RegExp(`/print/snapshot/\\?id=${NEWER.id}$`));
		expect(hrefs[1]).toMatch(new RegExp(`/print/snapshot/\\?id=${OLDER.id}$`));
		expect(text).toContain('Delete');
	});

	test('delete copy and focus targets', () => {
		expect(deleteTitle(NEWER)).toBe('Delete the ZIP 00199 snapshot from Oct 5?');
		expect(deletedAnnouncement('00199')).toBe('Deleted the ZIP 00199 snapshot.');
		expect(
			snapshotRowLine({ ...NEWER, options: { ...NEWER.options, sections: ['keyFigures'] } })
		).toContain('1 section');
		const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
		expect(focusTargetAfterDelete(list, 'a')).toBe('b');
		expect(focusTargetAfterDelete(list, 'c')).toBe('b');
		expect(focusTargetAfterDelete([{ id: 'a' }], 'a')).toBeNull();
	});
});
