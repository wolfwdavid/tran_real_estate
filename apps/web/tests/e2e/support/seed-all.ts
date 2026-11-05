// One synthetic row in every registered backup table (DEBT-05). A plain module, not a spec.
//
// seedAllBackupTables writes straight into the app database ('tran', opened WITHOUT a version so
// it never upgrades or downgrades it) in one readwrite transaction, like the raw seeders in
// tests/e2e/helpers/data.ts. Every row is fictional and shaped to pass its backup import schema
// (apps/web/src/lib/storage/backup-registry.ts): uuid ids, ownerId 'local', ISO stamps,
// deletedAt omitted. The memo artifact carries the 14-03 notes-numerals meta, computed here with
// the app's own memoArtifactMeta, so the round-trip proves that meta survives the Settings UI.
//
// Two backup "objects" span two tables each and share one id: a renter saved search is a
// savedSearches row + a renterSearchMeta row, and a buy box is a savedSearches row (portal
// 'investor') + a buyBoxes row. So savedSearches holds 2 rows; every other table holds 1.
// Both saved searches have lastRunAt = now, so the check-on-open scheduler finds nothing due.
//
// Call on a page whose origin already has the database at its current version (an app route such
// as settings/ has opened it once; the marketing home never opens it), then reload so the app
// runtime reads the rows.
import type { Page } from '@playwright/test';
import { memoArtifactMeta } from '../../../src/lib/features/investor/memo/memo-meta';

/** The 18 registered backup tables, in registry order. */
export const BACKUP_STORES = [
	'prefs',
	'ledger',
	'savedSearches',
	'searchSnapshots',
	'dataPrefs',
	'aiArtifacts',
	'renterShortlist',
	'renterSearchMeta',
	'deals',
	'investorDraft',
	'buyBoxes',
	'watchedZips',
	'contacts',
	'tasks',
	'activities',
	'agentProfile',
	'studioDraft',
	'snapshots'
] as const;
export type BackupStore = (typeof BACKUP_STORES)[number];

/** Rows written per table (savedSearches holds the renter search and the buy box). */
export const SEEDED_COUNTS: Readonly<Record<BackupStore, number>> = Object.freeze(
	Object.fromEntries(BACKUP_STORES.map((s) => [s, s === 'savedSearches' ? 2 : 1])) as Record<
		BackupStore,
		number
	>
);

const id = (n: number) => `5eed0000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** What each portal shows for its seeded row (all fictional). */
export const SEEDED = Object.freeze({
	dealId: id(1),
	artifactId: id(2),
	renterSearchId: id(3),
	buyBoxId: id(4),
	contactId: id(5),
	taskId: id(6),
	activityId: id(7),
	snapshotId: id(8),
	shortlistId: id(9),
	ledgerId: id(10),
	prefId: id(11),
	listingId: 'seeded-listing-maple-12',
	dealName: 'Seeded duplex on Maple Ct',
	contactName: 'Avery Quill',
	taskTitle: 'Call Avery about the Maple Ct showing',
	snapshotZip: '74201',
	snapshotTitle: 'ZIP 74201',
	shortlistStreet: '12 Maple Ct',
	savedSearchName: 'Seeded rentals near Maple Ct',
	buyBoxName: 'Seeded Maple Ct buy box',
	watchedZip: '74201',
	profileName: 'Rowan Seedwell',
	socialBrief: 'Seeded brief for the Maple Ct open house',
	memoNotes: 'Area rents rose 19% last year.',
	memoText: 'Area rents rose 19% last year.'
});

/** Fixed row ids the app uses for singleton-style rows (copied from the source modules). */
const FIXED = {
	// $lib/data/tables DATA_PREF_IDS.rentcastCap
	rentcastCapPref: '6f1c2b1e-4b8a-4d0e-9a51-3c7d2e8f4a01',
	// $lib/features/investor/analyzer/draftRepo DRAFT_ID
	analyzerDraft: '00000000-0000-4000-8000-00000000d4af',
	// $lib/storage/agent/tables PROFILE_ROW_ID
	agentProfile: '00000000-0000-4000-8000-000000a6e170',
	// $lib/storage/studio/tables STUDIO_DRAFT_IDS.social
	studioSocial: '00000000-0000-4000-8000-000000057d02'
} as const;

/** $lib/features/shared/markets/watched-zip-record watchedZipId(zip). */
const watchedZipId = (zip: string) => `00000000-0000-4000-8000-0000000${zip}`;

/** A 1x1 PNG (the agent logo field is a scan-exempt path; the bytes are harmless). */
const TINY_PNG =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** The other scan-exempt profile path: a uuid-shaped placeholder, built so no literal sits here. */
const PLACEHOLDER_FORM_ID = ['00000000', '0000', '4000', '8000', '000000005eed'].join('-');

type Row = Record<string, unknown>;

/** Every row except the ones whose dates depend on the browser's local calendar (the task). */
function buildRows(now: number): Record<BackupStore, Row[]> {
	const iso = new Date(now).toISOString();
	const stamp = (rowId: string): Row => ({
		id: rowId,
		ownerId: 'local',
		createdAt: iso,
		updatedAt: iso,
		schemaVersion: 1
	});
	const d = new Date(now);
	const periodKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
	const zip = SEEDED.snapshotZip;

	return {
		prefs: [{ ...stamp(SEEDED.prefId), key: 'e2e.seeded', value: 'backup round-trip' }],
		ledger: [
			{
				...stamp(SEEDED.ledgerId),
				periodKey,
				at: now - 60_000,
				endpoint: 'rental-listings',
				key: `rental-listings?limit=500&status=Active&zipCode=${zip}`,
				intent: 'user',
				status: 200,
				overCap: false,
				settledAt: now - 59_900
			}
		],
		savedSearches: [
			{
				...stamp(SEEDED.renterSearchId),
				portal: 'renter',
				name: SEEDED.savedSearchName,
				endpoint: 'rental-listings',
				params: { zipCode: zip, status: 'Active', limit: 500 },
				lastRunAt: now,
				lastSeenAt: now,
				claimedAt: null
			},
			{
				...stamp(SEEDED.buyBoxId),
				portal: 'investor',
				name: SEEDED.buyBoxName,
				endpoint: 'sale-listings',
				params: { zipCode: zip, status: 'Active', limit: 500 },
				lastRunAt: now,
				lastSeenAt: now,
				claimedAt: null
			}
		],
		// By convention id === searchId (the primary key), so the backup merge lines both up.
		searchSnapshots: [
			{
				...stamp(SEEDED.renterSearchId),
				searchId: SEEDED.renterSearchId,
				takenAt: now,
				truncated: false,
				items: {}
			}
		],
		dataPrefs: [{ ...stamp(FIXED.rentcastCapPref), key: 'rentcastCap', value: 40 }],
		aiArtifacts: [
			{
				...stamp(SEEDED.artifactId),
				feature: 'investor-memo',
				promptId: 'investor/memo.v1@1',
				provider: 'fixture',
				model: 'sample',
				sample: true,
				inputHash: 'ab'.repeat(32),
				text: SEEDED.memoText,
				findings: [],
				status: 'draft',
				sentAt: null,
				subjectId: SEEDED.dealId,
				meta: memoArtifactMeta('cd'.repeat(32), SEEDED.memoNotes)
			}
		],
		renterShortlist: [
			{
				...stamp(SEEDED.shortlistId),
				listingId: SEEDED.listingId,
				listing: {
					id: SEEDED.listingId,
					price: 1650,
					formattedAddress: `${SEEDED.shortlistStreet}, Harlow Springs, OK ${zip}`,
					addressLine1: SEEDED.shortlistStreet,
					addressLine2: null,
					city: 'Harlow Springs',
					state: 'OK',
					zipCode: zip,
					bedrooms: 2,
					bathrooms: 1,
					squareFootage: 900,
					status: 'Active'
				},
				provenance: { source: 'rentcast', fetchedAt: now - 3_600_000 },
				status: 'saved',
				statusChangedAt: now,
				statusHistory: [{ status: 'saved', at: now }],
				notes: ''
			}
		],
		renterSearchMeta: [
			{
				...stamp(SEEDED.renterSearchId),
				location: { kind: 'zip', zipCode: zip },
				filters: { priceMin: null, priceMax: null, beds: 'any', types: [], listedWithin: 'any' },
				sort: 'newest'
			}
		],
		deals: [
			{
				...stamp(SEEDED.dealId),
				name: SEEDED.dealName,
				address: `48 Maple Ct, Harlow Springs, OK ${zip}`,
				propertyType: 'multi-family',
				bedrooms: 4,
				bathrooms: 2,
				squareFeet: 1800,
				inputs: {
					priceCents: 25_000_000,
					closing: { unit: 'pct', bps: 300 },
					repairsCents: 0,
					financing: { kind: 'mortgage', downBps: 2500, annualRatePct: 7, termYears: 30 },
					rentCents: 240_000,
					otherIncomeCents: 0,
					expenses: []
				},
				sources: {},
				analyzerVersion: 1
			}
		],
		investorDraft: [
			{
				...stamp(FIXED.analyzerDraft),
				dealId: null,
				form: { expenses: [] },
				sources: {},
				savedSnapshot: null
			}
		],
		buyBoxes: [
			{
				...stamp(SEEDED.buyBoxId),
				criteria: {
					location: zip,
					minPriceCents: null,
					maxPriceCents: null,
					minBeds: 0,
					propertyTypes: []
				},
				targets: { minCapRatePct: null, minRentToPricePct: null },
				expenseBps: 4000
			}
		],
		watchedZips: [
			{ ...stamp(watchedZipId(SEEDED.watchedZip)), zip: SEEDED.watchedZip, addedAt: now }
		],
		contacts: [
			{
				...stamp(SEEDED.contactId),
				name: SEEDED.contactName,
				email: 'avery.quill@example.com',
				emailNorm: 'avery.quill@example.com',
				phone: '(555) 555-0147',
				phoneNorm: '5555550147',
				stage: 'new',
				stageChangedAt: iso,
				source: 'manual',
				propertyOfInterest: `${SEEDED.shortlistStreet}, Harlow Springs, OK`,
				notes: '',
				consentSource: 'unknown',
				emailOptOutAt: null,
				lastContactedAt: null,
				sample: false
			}
		],
		// dueDate is set to the browser's local "today" inside seedAllBackupTables.
		tasks: [
			{
				...stamp(SEEDED.taskId),
				contactId: SEEDED.contactId,
				title: SEEDED.taskTitle,
				dueDate: '',
				status: 'open',
				doneAt: null,
				sample: false
			}
		],
		activities: [
			{
				...stamp(SEEDED.activityId),
				contactId: SEEDED.contactId,
				type: 'added',
				text: 'Added Avery Quill',
				at: iso,
				sample: false
			}
		],
		agentProfile: [
			{
				...stamp(FIXED.agentProfile),
				name: SEEDED.profileName,
				brokerage: 'Seedwell Example Realty',
				teamName: '',
				licenseType: 'salesperson',
				licenseNumber: 'EX-5EED',
				licenseState: 'OK',
				brokerageLicenseNumber: '',
				brokeragePhone: '(555) 555-0148',
				phone: '(555) 555-0149',
				email: 'rowan.seedwell@example.com',
				website: '',
				iabsUrl: '',
				postal: { street: '', line2: '', city: '', state: '', zip: '' },
				brandPrimary: '#1F4E79',
				brandAccent: '',
				logo: { base64: TINY_PNG, mime: 'image/png', width: 1, height: 1, bytes: 68 },
				web3formsAccessKey: PLACEHOLDER_FORM_ID
			}
		],
		studioDraft: [
			{
				...stamp(FIXED.studioSocial),
				tool: 'social',
				data: {
					postType: 'just-listed',
					source: '',
					brief: SEEDED.socialBrief,
					cityOrArea: 'Harlow Springs',
					link: '',
					tone: 'warm'
				}
			}
		],
		// Aggregate-only snapshot (the backup re-runs the privacy guard): the snapshot-print shape.
		snapshots: [
			{
				id: SEEDED.snapshotId,
				zip,
				placeName: null,
				createdAt: iso,
				sample: false,
				source: 'rentcast',
				fetchedAt: iso,
				metrics: {
					zip,
					lastUpdated: iso.slice(0, 10),
					medianRent: 1600,
					medianPrice: 320000,
					priceToRent: 16.7,
					rentChangePct: 2.1,
					rentChangeFrom: '2025-09',
					rentChangeTo: '2026-08',
					months: 12,
					saleDom: 30,
					rentalDom: 20,
					saleTotal: 80,
					saleNew: 15,
					rentalTotal: 110,
					rentalNew: 25,
					rentByBedroom: [{ beds: 1, median: 1250, listings: 30 }]
				},
				series: { rentTrend: null, priceToRent: null },
				listingsSample: null,
				listingsFetchedAt: null,
				narrative: null,
				options: {
					eho: false,
					tranFooter: false,
					sections: ['keyFigures', 'rentByBedroom', 'domInventory']
				},
				agent: {
					disclosure: {
						fullName: SEEDED.profileName,
						brokerage: 'Seedwell Example Realty',
						licenseType: 'Salesperson',
						licenseNumber: 'EX-5EED',
						licenseState: 'OK',
						brokeragePhone: '(555) 555-0148'
					},
					brandPrimary: '#1F4E79',
					brandAccent: '',
					hasLogo: false
				},
				ownerId: 'local',
				updatedAt: iso,
				schemaVersion: 1
			}
		]
	};
}

/**
 * Writes the rows of every registered backup table in one transaction. Throws when the database
 * is missing a store (the origin has not opened the app database at its current version yet).
 * `skip` leaves tables out (mutation checks only).
 */
export async function seedAllBackupTables(
	page: Page,
	o: { skip?: readonly BackupStore[] } = {}
): Promise<void> {
	const skip = new Set(o.skip ?? []);
	const rows = Object.fromEntries(
		Object.entries(buildRows(Date.now())).filter(([store]) => !skip.has(store as BackupStore))
	);
	await page.evaluate(
		async ({ rows, stores }) => {
			// Opening a missing database would create an empty version 1 that the app then upgrades.
			if (!(await indexedDB.databases()).some((x) => x.name === 'tran')) {
				throw new Error('seed-all: open an app route first; the tran database does not exist');
			}
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open('tran');
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});
			const missing = stores.filter((s) => !db.objectStoreNames.contains(s));
			if (missing.length > 0) {
				db.close();
				throw new Error(`seed-all: the tran database lacks ${missing.join(', ')}`);
			}
			const d = new Date();
			const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(Object.keys(rows), 'readwrite');
				for (const [store, list] of Object.entries(rows)) {
					for (const row of list) {
						tx.objectStore(store).put(store === 'tasks' ? { ...row, dueDate: today } : row);
					}
				}
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
				tx.onabort = () => reject(tx.error);
			});
			db.close();
		},
		{ rows, stores: [...BACKUP_STORES] }
	);
}

/**
 * Row count per registered table. When the database does not exist, every count is 0 and the
 * database is NOT created (opening 'tran' without a version would create an empty version 1).
 */
export async function expectEveryTableSeeded(page: Page): Promise<Record<BackupStore, number>> {
	return page.evaluate(
		async (stores) => {
			const zero = Object.fromEntries(stores.map((s) => [s, 0]));
			const names = (await indexedDB.databases()).map((x) => x.name);
			if (!names.includes('tran')) return zero;
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open('tran');
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			});
			const present = stores.filter((s) => db.objectStoreNames.contains(s));
			const out: Record<string, number> = { ...zero };
			if (present.length > 0) {
				await new Promise<void>((resolve, reject) => {
					const tx = db.transaction(present, 'readonly');
					for (const s of present) {
						const req = tx.objectStore(s).count();
						req.onsuccess = () => (out[s] = req.result);
					}
					tx.oncomplete = () => resolve();
					tx.onerror = () => reject(tx.error);
				});
			}
			db.close();
			return out;
		},
		[...BACKUP_STORES]
	) as Promise<Record<BackupStore, number>>;
}
