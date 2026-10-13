import { tokens } from '@tran/brand';
import { describe, expect, test } from 'vitest';
import { ogCardSvg, renderOgCard, type OgCard } from './og-card.server.js';

const W = 1200;
const H = 630;
const TOOL_SUBLINE = 'Runs in your browser. No sign-up, no API key.';

const capRate: OgCard = {
	eyebrow: 'FREE CALCULATOR',
	titleLines: ['Cap rate', 'calculator'],
	subline: TOOL_SUBLINE,
	mark: 'investor'
};

/** The six real cards (UI-SPEC "OG Share Cards"); content ships in lib/content/tools.ts (plan 10-10). */
const FIXTURES: Record<string, OgCard> = {
	affordability: {
		eyebrow: 'FREE CALCULATOR',
		titleLines: ['Rent affordability', 'calculator'],
		subline: TOOL_SUBLINE,
		mark: 'renter'
	},
	'cap-rate': capRate,
	'cash-on-cash': {
		eyebrow: 'FREE CALCULATOR',
		titleLines: ['Cash-on-cash return', 'calculator'],
		subline: TOOL_SUBLINE,
		mark: 'investor'
	},
	dscr: {
		eyebrow: 'FREE CALCULATOR',
		titleLines: ['DSCR calculator'],
		subline: TOOL_SUBLINE,
		mark: 'investor'
	},
	tools: {
		eyebrow: 'FREE CALCULATOR',
		titleLines: ['Free real estate', 'calculators'],
		subline: TOOL_SUBLINE,
		mark: 'investor'
	},
	default: {
		eyebrow: 'FOR RENTERS, INVESTORS, AND AGENTS',
		titleLines: ['Real estate tools that', 'do the refreshing for you'],
		subline: 'Listing data from RentCast. Your own API keys. No Tran server.',
		mark: null
	}
};

type Rendered = ReturnType<typeof renderOgCard>;
interface Box {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}
const FULL: Box = { x0: 0, y0: 0, x1: W, y1: H };

function rgba(img: Rendered): Uint8Array {
	return new Uint8Array(img.pixels.buffer, img.pixels.byteOffset, img.pixels.byteLength);
}

function darkPixels(img: Rendered, box: Box = FULL): number {
	const px = rgba(img);
	let n = 0;
	for (let y = box.y0; y < box.y1; y++) {
		for (let x = box.x0; x < box.x1; x++) {
			const i = (y * img.width + x) * 4;
			if (px[i] < 90 && px[i + 1] < 90 && px[i + 2] < 90) n++;
		}
	}
	return n;
}

/** Pixels that differ between two renders inside a box: with vs without fonts isolates the text. */
function differingPixels(a: Rendered, b: Rendered, box: Box): number {
	const pa = rgba(a);
	const pb = rgba(b);
	let n = 0;
	for (let y = box.y0; y < box.y1; y++) {
		for (let x = box.x0; x < box.x1; x++) {
			const i = (y * a.width + x) * 4;
			if (pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2]) n++;
		}
	}
	return n;
}

const TEXT_BOX: Box = { x0: 80, y0: 80, x1: 760, y1: 460 };
const RIGHT_PADDING: Box = { x0: 1120, y0: 0, x1: W, y1: 600 };
// Bounding square of the 320px mark disc centred at (960, 300).
const DISC: Box = { x0: 800, y0: 140, x1: 1120, y1: 460 };

describe('renderOgCard', () => {
	const fonted = renderOgCard(capRate);
	const png = fonted.asPng();

	test('is a 1200x630 PNG under 200 KB', () => {
		expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
		expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
		expect(png.readUInt32BE(16)).toBe(W);
		expect(png.readUInt32BE(20)).toBe(H);
		expect(png.length).toBeLessThanOrEqual(204_800);
	});

	test('draws real text from the brand fonts', () => {
		expect(darkPixels(fonted)).toBeGreaterThan(1000);
		expect(darkPixels(fonted, TEXT_BOX)).toBeGreaterThan(1000);
	});

	test('non-vacuity: without fonts the same card has no text', () => {
		const bare = renderOgCard(capRate, { fontFiles: [] });
		expect(darkPixels(bare, TEXT_BOX)).toBe(0);
	});

	test('is deterministic', () => {
		expect(Buffer.compare(renderOgCard(capRate).asPng(), png)).toBe(0);
	});

	test.each(Object.entries(FIXTURES))(
		'%s card keeps text out of the right padding and off the mark',
		(_slug, card) => {
			const withText = renderOgCard(card);
			const withoutText = renderOgCard(card, { fontFiles: [] });
			expect(darkPixels(withText, TEXT_BOX)).toBeGreaterThan(1000);
			expect(darkPixels(withText, RIGHT_PADDING)).toBe(0);
			expect(differingPixels(withText, withoutText, RIGHT_PADDING)).toBe(0);
			if (card.mark) expect(differingPixels(withText, withoutText, DISC)).toBe(0);
			expect(withText.asPng().length).toBeLessThanOrEqual(204_800);
		}
	);
});

describe('ogCardSvg', () => {
	const tokenHexes = new Set(Object.values(tokens.color).map((h) => h.toLowerCase()));

	test.each(Object.entries(FIXTURES))(
		'%s uses only brand token colors and no images',
		(_s, card) => {
			const svg = ogCardSvg(card);
			const hexes = svg.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
			expect(hexes.length).toBeGreaterThan(0);
			for (const hex of hexes) expect(tokenHexes).toContain(hex.toLowerCase());
			expect(svg).not.toContain('data:');
			expect(svg).not.toContain('<image');
			expect(svg).toContain('height="12"');
		}
	);

	test('escapes text so card copy cannot inject markup', () => {
		const svg = ogCardSvg({ ...capRate, titleLines: ['A & B <x>'], subline: 'say "hi"' });
		expect(svg).toContain('A &#38; B &#60;x&#62;');
		expect(svg).toContain('say &#34;hi&#34;');
		expect(svg).not.toContain('<x>');
	});

	test('draws the mark disc only for tool cards', () => {
		expect(ogCardSvg(capRate)).toContain('r="160"');
		expect(ogCardSvg(FIXTURES.default)).not.toContain('r="160"');
	});
});
