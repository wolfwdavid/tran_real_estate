// Seeded, deterministic generator for the synthetic RentCast-shaped sample dataset (DATA-01).
// Usage: node scripts/gen-fixtures.mjs [--out <dir>] [--check]
//   (no flag)  write the six fixture files to the out dir
//   --check    render in memory and compare byte-for-byte with the files in the out dir
// Every place, person and number produced here is made up. The three metros sit in USPS-unassigned
// ZIP3 prefixes (742, 702, 858), streets and surnames are invented, emails and URLs use
// example.com, phones are 555-01xx and MLS numbers start SAMPLE-. scripts/lib/real-data-rules.mjs
// enforces all of that on the committed output.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

export const SEED = 20261004;
export const ANCHOR = '2026-10-01T00:00:00.000Z';
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_OUT = 'apps/web/src/lib/data/fixtures';
export const FIXTURE_FILES = [
	'metros.json',
	'rentals.json',
	'sales.json',
	'estimates.json',
	'markets.json',
	'meta.json'
];

const DAY_MS = 86_400_000;
const ANCHOR_MS = Date.parse(ANCHOR);

const METROS = [
	{
		id: 'metro-742',
		slug: 'harlow-springs',
		city: 'Harlow Springs',
		state: 'OK',
		stateFips: '40',
		county: 'Harlow County',
		zipCodes: ['74201', '74203'],
		centroid: { latitude: 36.7512, longitude: -101.9874 },
		areaCode: '580'
	},
	{
		id: 'metro-702',
		slug: 'bayou-verde',
		city: 'Bayou Verde',
		state: 'LA',
		stateFips: '22',
		county: 'Verde Parish',
		zipCodes: ['70201', '70204'],
		centroid: { latitude: 29.3105, longitude: -90.9411 },
		areaCode: '985'
	},
	{
		id: 'metro-858',
		slug: 'juniper-mesa',
		city: 'Juniper Mesa',
		state: 'AZ',
		stateFips: '04',
		county: 'Mesa Verdant County',
		zipCodes: ['85801', '85806'],
		centroid: { latitude: 32.1508, longitude: -113.2216 },
		areaCode: '928'
	}
];

const STREETS = [
	'Ledgerstone Ln',
	'Quillbrook Dr',
	'Amberfield Way',
	'Saltmarrow Ct',
	'Thimbleridge Rd',
	'Copperwick Ave',
	'Fernmoss Loop',
	'Brindlecott St',
	'Tallowmere Pl',
	'Wrenhollow Trl',
	'Marrowby Cir',
	'Gildenreach Blvd'
];
const FIRST_NAMES = [
	'Avery',
	'Jordan',
	'Rowan',
	'Quinn',
	'Harper',
	'Emerson',
	'Reese',
	'Sage',
	'Marlowe',
	'Linden'
];
const SURNAMES = [
	'Quillfeather',
	'Ambershaw',
	'Tallowmere',
	'Brindlecott',
	'Fernwhistle',
	'Copperlane',
	'Marrowby',
	'Thistlemoor',
	'Wrenhaven',
	'Gildenrow',
	'Larkwhistle'
];
const PROPERTY_TYPES = [
	'Single Family',
	'Condo',
	'Townhouse',
	'Apartment',
	'Multi-Family',
	'Manufactured'
];
const RENTALS_PER_METRO = [20, 20, 20];
const SALES_PER_METRO = [14, 13, 13];
const RECENT_RENTALS_PER_METRO = 4; // 12 rentals listed within 7 days of the anchor
const RECENT_SALES_PER_METRO = 3; // 9 sales listed within 7 days of the anchor
const LAND_SALE_INDEX = 5;
const NEW_CONSTRUCTION = new Set(['metro-742:2', 'metro-858:1']);
const INACTIVE_RENTALS = new Set(['metro-742:19', 'metro-702:18', 'metro-858:17']);
const INACTIVE_SALES = new Set(['metro-742:13', 'metro-702:12']);
const MARKET_MONTHS = 24;

function mulberry32(a) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const pad = (n, width) => String(n).padStart(width, '0');
const isoDaysBefore = (days) => new Date(ANCHOR_MS - days * DAY_MS).toISOString();
const dayKey = (iso) => iso.slice(0, 10);
const roundTo = (value, step) => Math.round(value / step) * step;
const round2 = (value) => Math.round(value * 100) / 100;
const round4 = (value) => Math.round(value * 10_000) / 10_000;
const median = (values) => {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;
const byLastSeenThenId = (a, b) =>
	a.lastSeenDate === b.lastSeenDate
		? a.id.localeCompare(b.id)
		: b.lastSeenDate.localeCompare(a.lastSeenDate);

function createRandom(seed) {
	const next = mulberry32(seed);
	const int = (min, max) => min + Math.floor(next() * (max - min + 1));
	return {
		next,
		int,
		pick: (list) => list[int(0, list.length - 1)],
		step: (min, max, stepSize) => min + int(0, Math.round((max - min) / stepSize)) * stepSize,
		jitter: (spread) => (next() * 2 - 1) * spread
	};
}

function createContacts(rand) {
	let n = 0;
	const phone = (metro) => `${metro.areaCode}555${pad(100 + (n++ % 100), 4)}`;
	return {
		agent(metro) {
			const first = rand.pick(FIRST_NAMES);
			const last = rand.pick(SURNAMES);
			const slug = `${first}-${last}`.toLowerCase();
			return {
				name: `${first} ${last}`,
				phone: phone(metro),
				email: `${first}.${last}@example.com`.toLowerCase(),
				website: `https://example.com/agents/${slug}`
			};
		},
		office(metro) {
			return {
				name: `Sample Realty ${metro.city}`,
				phone: phone(metro),
				email: `office.${metro.slug}@example.com`,
				website: `https://example.com/offices/${metro.slug}`
			};
		},
		builder(metro) {
			return {
				name: 'Sample Builders',
				development: `${metro.city} Commons`,
				phone: phone(metro),
				website: 'https://example.com/builders/sample'
			};
		}
	};
}

function historyEvent(kind, price, listedDays, removedDays) {
	return {
		event: kind === 'rental' ? 'Rental Listing' : 'Sale Listing',
		price,
		listingType: 'Standard',
		listedDate: isoDaysBefore(listedDays),
		removedDate: removedDays === null ? null : isoDaysBefore(removedDays),
		daysOnMarket: (removedDays === null ? listedDays : listedDays - removedDays) || 0
	};
}

function buildListing(ctx, kind, metro, metroIndex, i, serial) {
	const { rand, contacts, mlsCounters } = ctx;
	const tag = `${metro.id}:${i}`;
	const zip = metro.zipCodes[i % 2];
	const zip3 = zip.slice(0, 3);
	const isSale = kind === 'sale';
	const isLand = isSale && i === LAND_SALE_INDEX;
	const isNewConstruction = isSale && NEW_CONSTRUCTION.has(tag);
	const inactive = (isSale ? INACTIVE_SALES : INACTIVE_RENTALS).has(tag);
	const recentCount = isSale ? RECENT_SALES_PER_METRO : RECENT_RENTALS_PER_METRO;

	const propertyType = isLand ? 'Land' : rand.pick(PROPERTY_TYPES);
	const hasLot = !['Condo', 'Apartment'].includes(propertyType);
	const bedrooms = isLand ? null : propertyType === 'Apartment' ? rand.int(0, 3) : rand.int(1, 5);
	const bathrooms = isLand ? null : rand.step(1, 3.5, 0.5);
	const squareFootage = isLand ? null : rand.step(450, 3200, 10);
	const lotSize = hasLot ? rand.step(isLand ? 8000 : 2400, isLand ? 43000 : 12000, 50) : null;
	const yearBuilt = isLand ? null : isNewConstruction ? 2024 : rand.int(1958, 2024);
	const price = isSale ? rand.step(140_000, 620_000, 1000) : rand.step(900, 3200, 25);
	const hoa = ['Condo', 'Townhouse'].includes(propertyType)
		? { fee: rand.step(150, 450, 5) }
		: null;

	const listedDays = i < recentCount ? rand.int(0, 6) : rand.int(inactive ? 20 : 8, 90);
	const removedDays = inactive ? rand.int(1, 5) : null;
	const lastSeenDays = inactive ? removedDays : Math.min(rand.int(0, 2), listedDays);
	const listedDate = isoDaysBefore(listedDays);
	const num = rand.int(100, 9899);
	const street = rand.pick(STREETS);

	const history = {};
	const priceChange = serial % 5 === 2 && listedDays >= 8;
	const relisted = serial % 7 === 3;
	if (relisted) {
		const priorListed = listedDays + rand.int(120, 200);
		const priorRemoved = listedDays + rand.int(30, 90);
		const priorPrice = roundTo(price * (1 + rand.next() * 0.06), isSale ? 1000 : 25);
		history[dayKey(isoDaysBefore(priorListed))] = historyEvent(
			kind,
			priorPrice,
			priorListed,
			priorRemoved
		);
	}
	if (priceChange) {
		const originalPrice = roundTo(price * (1.03 + rand.next() * 0.05), isSale ? 1000 : 25);
		const changeDays = rand.int(1, listedDays - 1);
		history[dayKey(listedDate)] = historyEvent(kind, originalPrice, listedDays, removedDays);
		history[dayKey(isoDaysBefore(changeDays))] = historyEvent(kind, price, listedDays, removedDays);
	} else {
		history[dayKey(listedDate)] = historyEvent(kind, price, listedDays, removedDays);
	}

	mlsCounters[metroIndex] += 1;
	const coordinate = (center) => round4(center + rand.jitter(0.03));

	return {
		id: `SAMPLE-${zip}-${isSale ? 'S' : 'R'}${pad(serial, 3)}`,
		formattedAddress: `${num} ${street}, ${metro.city}, ${metro.state} ${zip}`,
		addressLine1: `${num} ${street}`,
		addressLine2: null,
		city: metro.city,
		state: metro.state,
		stateFips: metro.stateFips,
		zipCode: zip,
		county: metro.county,
		countyFips: null,
		latitude: coordinate(metro.centroid.latitude),
		longitude: coordinate(metro.centroid.longitude),
		propertyType,
		bedrooms,
		bathrooms,
		squareFootage,
		lotSize,
		yearBuilt,
		hoa,
		status: inactive ? 'Inactive' : 'Active',
		price,
		listingType: isNewConstruction ? 'New Construction' : 'Standard',
		listedDate,
		removedDate: removedDays === null ? null : isoDaysBefore(removedDays),
		createdDate: listedDate,
		lastSeenDate: isoDaysBefore(lastSeenDays),
		daysOnMarket: listedDays,
		mlsName: 'Sample MLS',
		mlsNumber: `SAMPLE-${zip3}-${pad(mlsCounters[metroIndex], 4)}`,
		listingAgent: contacts.agent(metro),
		listingOffice: contacts.office(metro),
		builder: isNewConstruction ? contacts.builder(metro) : null,
		history
	};
}

function buildListings(ctx, kind, perMetro) {
	const listings = [];
	let serial = 0;
	METROS.forEach((metro, metroIndex) => {
		for (let i = 0; i < perMetro[metroIndex]; i++) {
			serial += 1;
			listings.push(buildListing(ctx, kind, metro, metroIndex, i, serial));
		}
	});
	return listings.sort(byLastSeenThenId);
}

const omitAreaCode = (metro) =>
	Object.fromEntries(Object.entries(metro).filter(([key]) => key !== 'areaCode'));

const metroOf = (listing) => METROS.find((m) => m.city === listing.city);

function comparables(subject, pool) {
	const metro = metroOf(subject);
	return pool
		.filter((c) => c.id !== subject.id && metroOf(c) === metro)
		.map((c) => ({ id: c.id, distance: Math.abs((c.bedrooms ?? 0) - (subject.bedrooms ?? 0)) }))
		.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
		.slice(0, 5)
		.map((c) => c.id);
}

function estimateBase(listing) {
	return {
		formattedAddress: listing.formattedAddress,
		latitude: listing.latitude,
		longitude: listing.longitude,
		bedrooms: listing.bedrooms,
		bathrooms: listing.bathrooms,
		squareFootage: listing.squareFootage,
		propertyType: listing.propertyType
	};
}

function buildEstimates(rand, rentals, sales) {
	const rent = [...rentals, ...sales].map((listing) => {
		const isRental = listing.id.includes('-R');
		const raw = isRental
			? listing.price * (0.95 + rand.next() * 0.1)
			: 850 + (listing.bedrooms ?? 0) * 325 + (listing.squareFootage ?? 0) * 0.2;
		const value = roundTo(raw, 25);
		return {
			...estimateBase(listing),
			rent: value,
			rentRangeLow: roundTo(value * 0.85, 25),
			rentRangeHigh: roundTo(value * 1.15, 25),
			comparableIds: comparables(listing, rentals)
		};
	});
	const sale = sales.map((listing) => {
		const value = roundTo(listing.price * (0.95 + rand.next() * 0.1), 1000);
		return {
			...estimateBase(listing),
			price: value,
			priceRangeLow: roundTo(value * 0.85, 1000),
			priceRangeHigh: roundTo(value * 1.15, 1000),
			comparableIds: comparables(listing, sales)
		};
	});
	return { rent, sale };
}

function priceStats(rand, center, step, noun) {
	const med = roundTo(center, step);
	return {
		[`average${noun}`]: roundTo(med * (1.02 + rand.next() * 0.06), step),
		[`median${noun}`]: med,
		[`min${noun}`]: roundTo(med * (0.45 + rand.next() * 0.15), step),
		[`max${noun}`]: roundTo(med * (1.9 + rand.next() * 0.7), step)
	};
}

function marketSide(rand, listings, side) {
	const isSale = side === 'sale';
	const noun = isSale ? 'Price' : 'Rent';
	const step = isSale ? 1000 : 5;
	const prices = listings.map((l) => l.price);
	const center = median(prices);
	const sized = listings.filter((l) => l.squareFootage);
	const averageSquareFootage = Math.round(mean(sized.map((l) => l.squareFootage)));
	const totalListings = rand.int(isSale ? 60 : 90, isSale ? 180 : 260);
	const current = priceStats(rand, center, step, noun);
	const types = [...new Set(listings.map((l) => l.propertyType))].sort();
	const typeWeights = types.map(() => 1 + rand.next() * 3);
	const weightSum = typeWeights.reduce((s, w) => s + w, 0);

	const months = [];
	for (let k = MARKET_MONTHS - 1; k >= 0; k--) {
		const d = new Date(Date.UTC(2026, 8 - k, 1));
		months.push(d);
	}
	const history = {};
	months.forEach((d, idx) => {
		const trend = 0.92 + (0.08 * idx) / (MARKET_MONTHS - 1);
		const seasonal = 1 + 0.015 * Math.sin((d.getUTCMonth() / 12) * 2 * Math.PI);
		const key = d.toISOString().slice(0, 7);
		history[key] = {
			date: d.toISOString(),
			...priceStats(rand, center * trend * seasonal, step, noun),
			averageDaysOnMarket: round2(isSale ? 30 + rand.next() * 40 : 18 + rand.next() * 25),
			newListings: rand.int(isSale ? 10 : 20, isSale ? 45 : 70),
			totalListings: rand.int(isSale ? 55 : 85, isSale ? 185 : 265)
		};
	});

	return {
		lastUpdatedDate: isoDaysBefore(1),
		...current,
		[`average${noun}PerSquareFoot`]: round2(current[`average${noun}`] / averageSquareFootage),
		[`median${noun}PerSquareFoot`]: round2(current[`median${noun}`] / averageSquareFootage),
		averageSquareFootage,
		averageDaysOnMarket: round2(mean(listings.map((l) => l.daysOnMarket))),
		medianDaysOnMarket: median(listings.map((l) => l.daysOnMarket)),
		newListings: rand.int(isSale ? 10 : 20, isSale ? 45 : 70),
		totalListings,
		dataByPropertyType: types.map((propertyType, t) => ({
			propertyType,
			...priceStats(rand, center * (0.8 + rand.next() * 0.4), step, noun),
			totalListings: Math.max(1, Math.round((totalListings * typeWeights[t]) / weightSum))
		})),
		dataByBedrooms: [0, 1, 2, 3, 4, 5].map((bedrooms) => ({
			bedrooms,
			...priceStats(rand, center * (0.6 + bedrooms * 0.16), step, noun),
			totalListings: rand.int(4, Math.max(5, Math.round(totalListings / 3)))
		})),
		history
	};
}

function buildMarkets(rand, rentals, sales) {
	return METROS.flatMap((metro) =>
		metro.zipCodes.map((zip) => ({
			id: zip,
			zipCode: zip,
			saleData: marketSide(
				rand,
				sales.filter((l) => l.zipCode === zip),
				'sale'
			),
			rentalData: marketSide(
				rand,
				rentals.filter((l) => l.zipCode === zip),
				'rental'
			)
		}))
	);
}

/** Builds every fixture object in memory. Pure and deterministic: same seed, same output. */
export function generateFixtureData() {
	const rand = createRandom(SEED);
	const ctx = { rand, contacts: createContacts(rand), mlsCounters: METROS.map(() => 0) };
	const rentals = buildListings(ctx, 'rental', RENTALS_PER_METRO);
	const sales = buildListings(ctx, 'sale', SALES_PER_METRO);
	const estimates = buildEstimates(rand, rentals, sales);
	const markets = buildMarkets(rand, rentals, sales);
	return {
		'metros.json': METROS.map((metro) => omitAreaCode(metro)),
		'rentals.json': rentals,
		'sales.json': sales,
		'estimates.json': estimates,
		'markets.json': markets,
		'meta.json': {
			schema: 'tran-fixtures',
			version: 1,
			seed: SEED,
			anchor: ANCHOR,
			generator: 'scripts/gen-fixtures.mjs',
			counts: {
				rentals: rentals.length,
				sales: sales.length,
				rentEstimates: estimates.rent.length,
				saleEstimates: estimates.sale.length,
				markets: markets.length
			},
			note: 'Synthetic sample data. Every place, person and number here is made up.'
		}
	};
}

/**
 * Renders each fixture through Prettier with the repo config. The config is always resolved
 * from the canonical fixture path so a --out copy elsewhere formats identically.
 * @returns {Promise<Record<string, string>>}
 */
export async function renderFixtureFiles() {
	const data = generateFixtureData();
	const rendered = {};
	for (const name of FIXTURE_FILES) {
		const target = join(REPO_ROOT, DEFAULT_OUT, name);
		const config = (await prettier.resolveConfig(target)) ?? {};
		rendered[name] = await prettier.format(JSON.stringify(data[name]), {
			...config,
			filepath: target
		});
	}
	return rendered;
}

async function main(argv) {
	const outIndex = argv.indexOf('--out');
	const outArg = outIndex >= 0 ? argv[outIndex + 1] : undefined;
	if (outIndex >= 0 && !outArg) {
		console.error('Usage: node scripts/gen-fixtures.mjs [--out <dir>] [--check]');
		return 2;
	}
	const outDir = outArg ? resolve(process.cwd(), outArg) : join(REPO_ROOT, DEFAULT_OUT);
	const rendered = await renderFixtureFiles();

	if (argv.includes('--check')) {
		const drift = FIXTURE_FILES.filter((name) => {
			const file = join(outDir, name);
			return !existsSync(file) || readFileSync(file, 'utf8') !== rendered[name];
		});
		if (drift.length) {
			for (const name of drift) console.error(`Fixture drift: ${name}`);
			console.error('Regenerate with: pnpm fixtures:gen (never hand-edit fixture JSON)');
			return 1;
		}
		console.log(`Fixtures match generator output (${FIXTURE_FILES.length} files)`);
		return 0;
	}

	mkdirSync(outDir, { recursive: true });
	for (const name of FIXTURE_FILES) writeFileSync(join(outDir, name), rendered[name]);
	console.log(`Wrote ${FIXTURE_FILES.length} fixture files to ${outDir}`);
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main(process.argv.slice(2));
}
