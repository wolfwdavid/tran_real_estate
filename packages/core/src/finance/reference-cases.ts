// Nine hand-checked reference deals (INV-01, RESEARCH "Reference Cases"). Every expected integer is
// exact cents; every ratio is an integer fraction {num, den} asserted to 1e-9. The worked math sits
// above each case. Never edit an expected number to make a case pass: fix the analyzer instead.
//
// Conventions: vacancy = % of GSI (rent + other income); management = % of EGI (GSI − vacancy);
// maintenance, capital reserves and custom % lines = % of rent; OpEx excludes vacancy; NOI = EGI −
// OpEx; cash flow = NOI − P&I; cash invested = down + closing + repairs; annual = 12 × monthly.
// Percent amounts use mulBps (half away from zero). P&I comes from monthlyPayment.

import type { DealInputs, ExpenseLine, NullReason } from './types.js';

export type RatioKey = 'capRatePct' | 'cocPct' | 'dscr' | 'grm' | 'rentToPricePct';

export type IntKey =
	| 'gsiMonthly'
	| 'vacancyMonthly'
	| 'egiMonthly'
	| 'opexMonthly'
	| 'expensesInclVacancyMonthly'
	| 'downPaymentCents'
	| 'closingCents'
	| 'loanCents'
	| 'cashInvestedCents'
	| 'paymentMonthly'
	| 'noiMonthly'
	| 'noiAnnual'
	| 'cashFlowMonthly'
	| 'cashFlowAnnual';

export interface ReferenceCase {
	id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
	title: string;
	inputs: DealInputs;
	expected: {
		ints: Partial<Record<IntKey, number>>;
		/** Monthly cents per line id. */
		lines?: Record<string, number>;
		/** A ratio as an integer fraction, or null with the reason. */
		ratios: Partial<Record<RatioKey, { num: number; den: number } | null>>;
		reasons?: Partial<
			Record<
				'payment' | 'cashFlow' | 'coc' | 'dscr' | 'grm' | 'capRate' | 'rentToPrice',
				NullReason
			>
		>;
		meetsOnePct: boolean;
	};
}

interface LineAmounts {
	vacancy: number;
	management: number;
	maintenance: number;
	capex: number;
	tax: number;
	insurance: number;
	hoa?: number;
	utilities?: number;
}

/** The eight default kinds: four percent lines (bps) and four monthly dollar lines (cents). */
function lines(a: LineAmounts): ExpenseLine[] {
	return [
		{ id: 'vacancy', kind: 'vacancy', name: 'Vacancy allowance', unit: 'pct', bps: a.vacancy },
		{
			id: 'management',
			kind: 'management',
			name: 'Property management',
			unit: 'pct',
			bps: a.management
		},
		{
			id: 'maintenance',
			kind: 'maintenance',
			name: 'Maintenance',
			unit: 'pct',
			bps: a.maintenance
		},
		{ id: 'capex', kind: 'capex', name: 'Capital reserves', unit: 'pct', bps: a.capex },
		{ id: 'tax', kind: 'tax', name: 'Property tax', unit: 'usd', cents: a.tax },
		{ id: 'insurance', kind: 'insurance', name: 'Insurance', unit: 'usd', cents: a.insurance },
		{ id: 'hoa', kind: 'hoa', name: 'HOA dues', unit: 'usd', cents: a.hoa ?? 0 },
		{
			id: 'utilities',
			kind: 'utilities',
			name: 'Owner-paid utilities',
			unit: 'usd',
			cents: a.utilities ?? 0
		}
	];
}

const mortgage = (downBps: number, annualRatePct: number, termYears: number) =>
	({ kind: 'mortgage', downBps, annualRatePct, termYears }) as const;

export const REFERENCE_CASES: ReferenceCase[] = [
	/*
	 * A. Baseline SFR
	 * down = 20000000×2000/10000 = 4000000; loan = 20000000 − 4000000 = 16000000
	 * P = 16000000 @ 7%/30y = 106448 ($1,064.48 published for $160,000 @ 7% / 30y)
	 * GSI = 200000 + 0 = 200000; vacancy = 200000×500/10000 = 10000
	 * EGI = 200000 − 10000 = 190000; management = 190000×800/10000 = 15200
	 * maintenance = capex = 200000×500/10000 = 10000
	 * OpEx = 15200 + 10000 + 10000 + 20000 + 10000 = 65200
	 * NOI = 190000 − 65200 = 124800; annual = 1497600
	 * CF = 124800 − 106448 = 18352; annual = 220224
	 * cash = 4000000 + 600000 + 0 = 4600000
	 * cap = 1497600×100/20000000 = 7.488%; CoC = 220224×100/4600000 = 4.787478…%
	 * DSCR = 1497600/(106448×12) = 1.172403…; GRM = 20000000/2400000 = 8.333…
	 * 1% rule: 200000×100 = 20000000 ≥ 20000000, pass (exactly 1.00%)
	 */
	{
		id: 'A',
		title: 'Baseline SFR',
		inputs: {
			priceCents: 20_000_000,
			closing: { unit: 'usd', cents: 600_000 },
			repairsCents: 0,
			financing: mortgage(2000, 7, 30),
			rentCents: 200_000,
			otherIncomeCents: 0,
			expenses: lines({
				vacancy: 500,
				management: 800,
				maintenance: 500,
				capex: 500,
				tax: 20_000,
				insurance: 10_000
			})
		},
		expected: {
			ints: {
				gsiMonthly: 200_000,
				vacancyMonthly: 10_000,
				egiMonthly: 190_000,
				opexMonthly: 65_200,
				expensesInclVacancyMonthly: 75_200,
				downPaymentCents: 4_000_000,
				closingCents: 600_000,
				loanCents: 16_000_000,
				cashInvestedCents: 4_600_000,
				paymentMonthly: 106_448,
				noiMonthly: 124_800,
				noiAnnual: 1_497_600,
				cashFlowMonthly: 18_352,
				cashFlowAnnual: 220_224
			},
			lines: {
				vacancy: 10_000,
				management: 15_200,
				maintenance: 10_000,
				capex: 10_000,
				tax: 20_000,
				insurance: 10_000,
				hoa: 0,
				utilities: 0
			},
			ratios: {
				capRatePct: { num: 1_497_600 * 100, den: 20_000_000 },
				cocPct: { num: 220_224 * 100, den: 4_600_000 },
				dscr: { num: 1_497_600, den: 106_448 * 12 },
				grm: { num: 20_000_000, den: 200_000 * 12 },
				rentToPricePct: { num: 1, den: 1 }
			},
			meetsOnePct: true
		}
	},
	/*
	 * B. All cash
	 * down = price = 15000000; loan = 0; P = 0
	 * GSI = 150000; vacancy = 150000×500/10000 = 7500
	 * EGI = 150000 − 7500 = 142500; management = 142500×0/10000 = 0
	 * maintenance = capex = 150000×500/10000 = 7500
	 * OpEx = 0 + 7500 + 7500 + 15000 + 8000 = 38000
	 * NOI = 142500 − 38000 = 104500; annual = 1254000
	 * CF = 104500 − 0 = 104500 (= NOI); annual = 1254000
	 * cash = 15000000 + 300000 = 15300000
	 * cap = 1254000×100/15000000 = 8.36%; CoC = 1254000×100/15300000 = 8.196078…%
	 * DSCR null (no loan); GRM = 15000000/1800000; 1% rule: 150000×100 = 15000000, pass
	 */
	{
		id: 'B',
		title: 'All cash',
		inputs: {
			priceCents: 15_000_000,
			closing: { unit: 'usd', cents: 300_000 },
			repairsCents: 0,
			financing: { kind: 'cash' },
			rentCents: 150_000,
			otherIncomeCents: 0,
			expenses: lines({
				vacancy: 500,
				management: 0,
				maintenance: 500,
				capex: 500,
				tax: 15_000,
				insurance: 8_000
			})
		},
		expected: {
			ints: {
				gsiMonthly: 150_000,
				vacancyMonthly: 7_500,
				egiMonthly: 142_500,
				opexMonthly: 38_000,
				downPaymentCents: 15_000_000,
				loanCents: 0,
				cashInvestedCents: 15_300_000,
				paymentMonthly: 0,
				noiMonthly: 104_500,
				noiAnnual: 1_254_000,
				cashFlowMonthly: 104_500,
				cashFlowAnnual: 1_254_000
			},
			ratios: {
				capRatePct: { num: 1_254_000 * 100, den: 15_000_000 },
				cocPct: { num: 1_254_000 * 100, den: 15_300_000 },
				dscr: null,
				grm: { num: 15_000_000, den: 150_000 * 12 },
				rentToPricePct: { num: 1, den: 1 }
			},
			reasons: { dscr: 'no-loan' },
			meetsOnePct: true
		}
	},
	/*
	 * C. 0% rate (division guard)
	 * down = 12000000×2500/10000 = 3000000; loan = 9000000
	 * P = 9000000/(15×12) = 9000000/180 = 50000 (no division by zero at r = 0)
	 * GSI = 120000; vacancy = 0; EGI = 120000 − 0 = 120000; all % lines 0
	 * OpEx = 10000 + 5000 = 15000; NOI = 120000 − 15000 = 105000; annual = 1260000
	 * CF = 105000 − 50000 = 55000; annual = 660000; cash = 3000000 + 0 = 3000000
	 * cap = 1260000×100/12000000 = 10.5%; CoC = 660000×100/3000000 = 22%
	 * DSCR = 1260000/600000 = 2.1; 1% rule: 120000×100 = 12000000, pass
	 */
	{
		id: 'C',
		title: '0% rate (division guard)',
		inputs: {
			priceCents: 12_000_000,
			closing: { unit: 'usd', cents: 0 },
			repairsCents: 0,
			financing: mortgage(2500, 0, 15),
			rentCents: 120_000,
			otherIncomeCents: 0,
			expenses: lines({
				vacancy: 0,
				management: 0,
				maintenance: 0,
				capex: 0,
				tax: 10_000,
				insurance: 5_000
			})
		},
		expected: {
			ints: {
				egiMonthly: 120_000,
				opexMonthly: 15_000,
				loanCents: 9_000_000,
				cashInvestedCents: 3_000_000,
				paymentMonthly: 50_000,
				noiMonthly: 105_000,
				noiAnnual: 1_260_000,
				cashFlowMonthly: 55_000,
				cashFlowAnnual: 660_000
			},
			ratios: {
				capRatePct: { num: 105, den: 10 },
				cocPct: { num: 22, den: 1 },
				dscr: { num: 21, den: 10 },
				grm: { num: 12_000_000, den: 120_000 * 12 }
			},
			meetsOnePct: true
		}
	},
	/*
	 * D. Negative cash flow + HOA
	 * down = 40000000×2000/10000 = 8000000; loan = 32000000
	 * P = 32000000 @ 7.5%/30y = 223749 ($2,237.49 published for $320,000 @ 7.5% / 30y)
	 * GSI = 250000; vacancy = 250000×500/10000 = 12500
	 * EGI = 250000 − 12500 = 237500; management = 237500×1000/10000 = 23750
	 * maintenance = capex = 250000×500/10000 = 12500
	 * OpEx = 23750 + 12500 + 12500 + 40000 + 15000 + 25000 = 128750
	 * NOI = 237500 − 128750 = 108750; annual = 1305000
	 * CF = 108750 − 223749 = −114999; annual = −1379988
	 * cash = 8000000 + 1200000 = 9200000
	 * cap = 1305000×100/40000000 = 3.2625%; CoC = −1379988×100/9200000 = −14.99987%
	 * DSCR = 1305000/(223749×12) = 0.486036…; GRM = 40000000/3000000 = 13.333…
	 * 1% rule: 250000×100 = 25000000 < 40000000, fail; rent/price = 0.625%
	 */
	{
		id: 'D',
		title: 'Negative cash flow + HOA',
		inputs: {
			priceCents: 40_000_000,
			closing: { unit: 'usd', cents: 1_200_000 },
			repairsCents: 0,
			financing: mortgage(2000, 7.5, 30),
			rentCents: 250_000,
			otherIncomeCents: 0,
			expenses: lines({
				vacancy: 500,
				management: 1000,
				maintenance: 500,
				capex: 500,
				tax: 40_000,
				insurance: 15_000,
				hoa: 25_000
			})
		},
		expected: {
			ints: {
				vacancyMonthly: 12_500,
				egiMonthly: 237_500,
				opexMonthly: 128_750,
				loanCents: 32_000_000,
				cashInvestedCents: 9_200_000,
				paymentMonthly: 223_749,
				noiMonthly: 108_750,
				noiAnnual: 1_305_000,
				cashFlowMonthly: -114_999,
				cashFlowAnnual: -1_379_988
			},
			lines: { management: 23_750, hoa: 25_000 },
			ratios: {
				capRatePct: { num: 1_305_000 * 100, den: 40_000_000 },
				cocPct: { num: -1_379_988 * 100, den: 9_200_000 },
				dscr: { num: 1_305_000, den: 223_749 * 12 },
				grm: { num: 40_000_000, den: 3_000_000 },
				rentToPricePct: { num: 625, den: 1000 }
			},
			meetsOnePct: false
		}
	},
	/*
	 * E. 1% boundary, 8% vacancy
	 * down = 10000000×2500/10000 = 2500000; loan = 7500000; P = 7500000 @ 6%/30y = 44966
	 * GSI = 100000; vacancy = 100000×800/10000 = 8000
	 * EGI = 100000 − 8000 = 92000; management = 92000×800/10000 = 7360
	 * maintenance = capex = 100000×500/10000 = 5000
	 * OpEx = 7360 + 5000 + 5000 + 10000 + 6000 = 33360
	 * NOI = 92000 − 33360 = 58640; annual = 703680
	 * CF = 58640 − 44966 = 13674; annual = 164088
	 * cash = 2500000 + 300000 = 2800000
	 * cap = 703680×100/10000000 = 7.0368%; CoC = 164088×100/2800000 = 5.860286…%
	 * DSCR = 703680/(44966×12) = 1.304096…
	 * 1% rule: 100000×100 = 10000000 ≥ 10000000, pass at the exact boundary
	 */
	{
		id: 'E',
		title: '1% boundary, 8% vacancy',
		inputs: {
			priceCents: 10_000_000,
			closing: { unit: 'usd', cents: 300_000 },
			repairsCents: 0,
			financing: mortgage(2500, 6, 30),
			rentCents: 100_000,
			otherIncomeCents: 0,
			expenses: lines({
				vacancy: 800,
				management: 800,
				maintenance: 500,
				capex: 500,
				tax: 10_000,
				insurance: 6_000
			})
		},
		expected: {
			ints: {
				vacancyMonthly: 8_000,
				egiMonthly: 92_000,
				opexMonthly: 33_360,
				loanCents: 7_500_000,
				cashInvestedCents: 2_800_000,
				paymentMonthly: 44_966,
				noiMonthly: 58_640,
				noiAnnual: 703_680,
				cashFlowMonthly: 13_674,
				cashFlowAnnual: 164_088
			},
			lines: { management: 7_360 },
			ratios: {
				capRatePct: { num: 703_680 * 100, den: 10_000_000 },
				cocPct: { num: 164_088 * 100, den: 2_800_000 },
				dscr: { num: 703_680, den: 44_966 * 12 },
				rentToPricePct: { num: 1, den: 1 }
			},
			meetsOnePct: true
		}
	},
	/*
	 * F. Duplex + other income + utilities
	 * down = 30000000×2500/10000 = 7500000; loan = 22500000; P = 22500000 @ 6.5%/30y = 142215
	 * GSI = 320000 + 10000 = 330000; vacancy = 330000×500/10000 = 16500
	 * EGI = 330000 − 16500 = 313500; management = 313500×800/10000 = 25080
	 * maintenance = 320000×600/10000 = 19200; capex = 320000×500/10000 = 16000
	 * OpEx = 25080 + 19200 + 16000 + 30000 + 12000 + 15000 = 117280
	 * NOI = 313500 − 117280 = 196220; annual = 2354640
	 * CF = 196220 − 142215 = 54005; annual = 648060
	 * cash = 7500000 + 900000 = 8400000
	 * cap = 2354640×100/30000000 = 7.8488%; CoC = 648060×100/8400000 = 7.715%
	 * DSCR = 2354640/(142215×12) = 1.379742…
	 * GRM = 30000000/(320000×12) = 30000000/3840000 = 7.8125 (rent only, before vacancy, no other income)
	 * 1% rule: 320000×100 = 32000000 ≥ 30000000, pass; rent/price = 1.0667%
	 */
	{
		id: 'F',
		title: 'Duplex + other income + utilities',
		inputs: {
			priceCents: 30_000_000,
			closing: { unit: 'usd', cents: 900_000 },
			repairsCents: 0,
			financing: mortgage(2500, 6.5, 30),
			rentCents: 320_000,
			otherIncomeCents: 10_000,
			expenses: lines({
				vacancy: 500,
				management: 800,
				maintenance: 600,
				capex: 500,
				tax: 30_000,
				insurance: 12_000,
				utilities: 15_000
			})
		},
		expected: {
			ints: {
				gsiMonthly: 330_000,
				vacancyMonthly: 16_500,
				egiMonthly: 313_500,
				opexMonthly: 117_280,
				expensesInclVacancyMonthly: 133_780,
				loanCents: 22_500_000,
				cashInvestedCents: 8_400_000,
				paymentMonthly: 142_215,
				noiMonthly: 196_220,
				noiAnnual: 2_354_640,
				cashFlowMonthly: 54_005,
				cashFlowAnnual: 648_060
			},
			lines: {
				vacancy: 16_500,
				management: 25_080,
				maintenance: 19_200,
				capex: 16_000,
				utilities: 15_000
			},
			ratios: {
				capRatePct: { num: 2_354_640 * 100, den: 30_000_000 },
				cocPct: { num: 648_060 * 100, den: 8_400_000 },
				dscr: { num: 2_354_640, den: 142_215 * 12 },
				grm: { num: 78_125, den: 10_000 },
				rentToPricePct: { num: 320_000 * 100, den: 30_000_000 }
			},
			meetsOnePct: true
		}
	},
	/*
	 * G. Zero rent (null guards)
	 * down = 10000000×2000/10000 = 2000000; loan = 8000000; P = 8000000 @ 7%/30y = 53224
	 * GSI = 0; vacancy = 0; EGI = 0 − 0 = 0; management = maintenance = capex = 0
	 * OpEx = 10000 + 5000 = 15000; NOI = 0 − 15000 = −15000; annual = −180000
	 * CF = −15000 − 53224 = −68224; annual = −818688; cash = 2000000 + 0 = 2000000
	 * cap = −180000×100/10000000 = −1.8%; CoC = −818688×100/2000000 = −40.9344%
	 * DSCR = −180000/(53224×12) = −0.281828… (negative, shown); GRM null (no rent)
	 * 1% rule: 0 < 10000000, fail; rent/price = 0%
	 */
	{
		id: 'G',
		title: 'Zero rent (null guards)',
		inputs: {
			priceCents: 10_000_000,
			closing: { unit: 'usd', cents: 0 },
			repairsCents: 0,
			financing: mortgage(2000, 7, 30),
			rentCents: 0,
			otherIncomeCents: 0,
			expenses: lines({
				vacancy: 500,
				management: 800,
				maintenance: 500,
				capex: 500,
				tax: 10_000,
				insurance: 5_000
			})
		},
		expected: {
			ints: {
				egiMonthly: 0,
				opexMonthly: 15_000,
				cashInvestedCents: 2_000_000,
				paymentMonthly: 53_224,
				noiMonthly: -15_000,
				noiAnnual: -180_000,
				cashFlowMonthly: -68_224,
				cashFlowAnnual: -818_688
			},
			ratios: {
				capRatePct: { num: -18, den: 10 },
				cocPct: { num: -818_688 * 100, den: 2_000_000 },
				dscr: { num: -180_000, den: 53_224 * 12 },
				grm: null,
				rentToPricePct: { num: 0, den: 1 }
			},
			reasons: { grm: 'no-rent' },
			meetsOnePct: false
		}
	},
	/*
	 * H. Odd numbers (rounding stress)
	 * down = 17777700×3333/10000 = 5925307.41 → 5925307; loan = 17777700 − 5925307 = 11852393
	 * P = 11852393 @ 6.25%/15y = 101625
	 * GSI = 177777; vacancy = 177777×333/10000 = 5919.97 → 5920
	 * EGI = 177777 − 5920 = 171857; management = 171857×777/10000 = 13353.29 → 13353
	 * maintenance = capex = 177777×500/10000 = 8888.85 → 8889
	 * OpEx = 13353 + 8889 + 8889 + 18518 + 9259 = 58908
	 * NOI = 171857 − 58908 = 112949; annual = 1355388
	 * CF = 112949 − 101625 = 11324; annual = 135888
	 * cash = 5925307 + 444444 = 6369751
	 * cap = 1355388×100/17777700 = 7.624091…%; CoC = 135888×100/6369751 = 2.133333…%
	 * DSCR = 1355388/(101625×12) = 1.111429…
	 */
	{
		id: 'H',
		title: 'Odd numbers (rounding stress)',
		inputs: {
			priceCents: 17_777_700,
			closing: { unit: 'usd', cents: 444_444 },
			repairsCents: 0,
			financing: mortgage(3333, 6.25, 15),
			rentCents: 177_777,
			otherIncomeCents: 0,
			expenses: lines({
				vacancy: 333,
				management: 777,
				maintenance: 500,
				capex: 500,
				tax: 18_518,
				insurance: 9_259
			})
		},
		expected: {
			ints: {
				vacancyMonthly: 5_920,
				egiMonthly: 171_857,
				opexMonthly: 58_908,
				downPaymentCents: 5_925_307,
				loanCents: 11_852_393,
				cashInvestedCents: 6_369_751,
				paymentMonthly: 101_625,
				noiMonthly: 112_949,
				noiAnnual: 1_355_388,
				cashFlowMonthly: 11_324,
				cashFlowAnnual: 135_888
			},
			lines: { management: 13_353, maintenance: 8_889, capex: 8_889 },
			ratios: {
				capRatePct: { num: 1_355_388 * 100, den: 17_777_700 },
				cocPct: { num: 135_888 * 100, den: 6_369_751 },
				dscr: { num: 1_355_388, den: 101_625 * 12 }
			},
			meetsOnePct: true
		}
	},
	/*
	 * I. Published-payment anchor
	 * down = 12500000×2000/10000 = 2500000; loan = 10000000
	 * P = 10000000 @ 6%/30y = 59955 ($599.55, the textbook $100,000 @ 6% / 30y)
	 * GSI = 125000; vacancy = 0; EGI = 125000 − 0 = 125000; OpEx = 0
	 * NOI = 125000 − 0 = 125000; annual = 1500000
	 * CF = 125000 − 59955 = 65045; annual = 780540; cash = 2500000 + 0 = 2500000
	 * cap = 1500000×100/12500000 = 12%; CoC = 780540×100/2500000 = 31.2216%
	 * DSCR = 1500000/(59955×12); 1% rule: 125000×100 = 12500000, pass
	 */
	{
		id: 'I',
		title: 'Published-payment anchor',
		inputs: {
			priceCents: 12_500_000,
			closing: { unit: 'usd', cents: 0 },
			repairsCents: 0,
			financing: mortgage(2000, 6, 30),
			rentCents: 125_000,
			otherIncomeCents: 0,
			expenses: lines({ vacancy: 0, management: 0, maintenance: 0, capex: 0, tax: 0, insurance: 0 })
		},
		expected: {
			ints: {
				egiMonthly: 125_000,
				opexMonthly: 0,
				loanCents: 10_000_000,
				cashInvestedCents: 2_500_000,
				paymentMonthly: 59_955,
				noiMonthly: 125_000,
				noiAnnual: 1_500_000,
				cashFlowMonthly: 65_045,
				cashFlowAnnual: 780_540
			},
			ratios: {
				capRatePct: { num: 12, den: 1 },
				cocPct: { num: 780_540 * 100, den: 2_500_000 },
				dscr: { num: 1_500_000, den: 59_955 * 12 }
			},
			meetsOnePct: true
		}
	}
];
