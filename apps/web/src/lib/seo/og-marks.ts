import { tokens } from '@tran/brand';

/**
 * Raster copies of Phase 2 artwork for the share cards. resvg has no CSS classes, so the Tailwind
 * classes are replaced by the matching `tokens.color` values. Keep in step with the sources:
 * - RenterMark:   apps/web/src/lib/components/brand/marks/RenterMark.svelte   (64x64)
 * - InvestorMark: apps/web/src/lib/components/brand/marks/InvestorMark.svelte (64x64)
 * - Contours:     apps/web/src/routes/(marketing)/+page.svelte `const contours` (480x360 viewBox)
 */
const c = tokens.color;
const line = `fill="none" stroke="${c.foreground}"`;
const surface = `fill="${c.surface}" stroke="${c.foreground}"`;
const terracotta = `fill="${c['deco-terracotta']}" stroke="${c.foreground}"`;
const sage = `fill="${c['deco-sage']}" stroke="${c.foreground}"`;
const group = (inner: string) =>
	`<g stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;
const windowRect = (x: number, y: number, w = 6, h = 6) =>
	`<rect ${surface} x="${x}" y="${y}" width="${w}" height="${h}" rx="0.5"/>`;

/** 64x64 viewBox inner markup of each property mark. */
export const OG_MARKS: Record<'renter' | 'investor', string> = {
	renter: group(
		[
			`<path ${surface} d="M16 56V12l16-4 16 4v44Z"/>`,
			`<path ${line} d="M13 12.75 32 8l19 4.75"/>`,
			...[17, 27, 37].flatMap((y) => [20, 29, 38].map((x) => windowRect(x, y))),
			`<path ${terracotta} d="M28 56v-8a4 4 0 0 1 8 0v8Z"/>`,
			`<path ${line} d="M10 56h44"/>`
		].join('')
	),
	investor: group(
		[
			`<path ${sage} d="M8 54V30l11-10 11 10v24Z"/>`,
			`<path ${sage} d="M30 54V30l11-10 11 10v24Z"/>`,
			`<path ${line} d="M6 31.8 19 20l11 10 11-10 13 11.8"/>`,
			windowRect(14, 34, 5, 6),
			windowRect(36, 34, 5, 6),
			`<path ${surface} d="M21 54v-9h5v9Z"/>`,
			`<path ${surface} d="M43 54v-9h5v9Z"/>`,
			`<path ${surface} d="M50.5 38.6 58.7 40.8 54.6 56l-8.2-2.2Z"/>`,
			`<path ${line} d="m50.2 43.3 5 1.3M49.2 47l5 1.3M48.2 50.7l5 1.3"/>`,
			`<path ${line} d="M4 54h56"/>`
		].join('')
	)
};

const CONTOUR_D = [
	'M417.5 110C418.3 117.6 412.2 130.4 404.6 134.8C397 139.1 382.9 136.2 372 136.2C361.1 136.2 347 139.1 339.4 134.8C331.8 130.4 325.7 117.6 326.5 110C327.4 102.4 336.9 94.8 344.5 89.1C352.1 83.4 362.8 76.1 372 76.1C381.2 76.1 391.9 83.4 399.5 89.1C407.1 94.8 416.6 102.4 417.5 110Z',
	'M462 110C463.7 123.7 446.6 146.9 431.6 155.3C416.7 163.7 392.3 160 372 160.3C351.7 160.6 323.5 165.4 310.1 157.1C296.6 148.7 290.2 124.9 291.3 110C292.3 95.1 302.7 78.1 316.2 67.6C329.6 57 354.5 46 372 46.9C389.5 47.7 405.9 62.3 420.9 72.8C435.9 83.4 460.2 96.3 462 110Z',
	'M508.2 110C510.5 129.5 478.9 161 456.2 174C433.6 187.1 401 187.7 372 188.4C343 189 301.2 191.1 282.5 178.1C263.7 165 259.4 132.6 259.6 110C259.8 87.4 264.8 57.7 283.5 42.7C302.2 27.8 345.6 17.7 372 20.1C398.4 22.4 419.4 41.8 442.1 56.8C464.8 71.7 505.8 90.5 508.2 110Z',
	'M552.3 110C554.5 135.4 509 172.7 479 191.3C448.9 209.9 408.8 220.8 372 221.7C335.2 222.5 282.3 214.9 258.5 196.3C234.6 177.7 230.6 140.1 228.8 110C227 79.9 223.9 34.5 247.8 15.6C271.6 -3.4 335.7 -7.5 372 -3.7C408.3 0.2 435.6 19.9 465.7 38.8C495.7 57.8 550.1 84.6 552.3 110Z',
	'M590.4 110C591.7 141.8 538.1 183.6 501.7 208.6C465.3 233.5 415.8 259.5 372 259.9C328.2 260.3 268.5 236 239.1 211C209.7 186 200.2 147.1 195.6 110C191.1 72.9 182.3 10.7 211.7 -11.8C241.1 -34.4 325 -30.2 372 -25.3C419 -20.4 457.1 -4.9 493.5 17.6C529.9 40.2 589 78.2 590.4 110Z',
	'M619.7 110C619.8 149.1 568 195.8 526.7 227.6C485.4 259.3 422.5 301.5 372 300.7C321.5 300 259.3 254.6 223.5 222.8C187.7 191.1 164.8 153.3 157.4 110C149.9 66.7 142.9 -10.7 178.7 -36.9C214.5 -63.1 314.1 -52.1 372 -47.1C429.9 -42.2 484.8 -33.3 526.1 -7.1C567.4 19.1 619.6 70.9 619.7 110Z',
	'M639.8 110C638.8 157.3 600.5 211.3 555.9 249.8C511.3 288.2 429.8 343.4 372 340.7C314.2 338 252.5 272 209.4 233.6C166.2 195.2 122.9 158.5 113.3 110C103.7 61.5 108.7 -27 151.8 -57.4C194.9 -87.7 303.7 -76.2 372 -72.4C440.3 -68.5 517.3 -64.7 561.9 -34.3C606.5 -3.9 640.8 62.7 639.8 110Z'
];

/** The hero contour motif as `<path>` elements in its 480x360 coordinate space, stroke `border`. */
export const CONTOUR_PATHS: string = CONTOUR_D.map(
	(d) => `<path fill="none" stroke="${c.border}" stroke-width="2" d="${d}"/>`
).join('');
