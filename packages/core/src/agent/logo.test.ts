import { describe, expect, test } from 'vitest';
import {
	LOGO_MAX_BYTES,
	LOGO_MAX_SIDE,
	RASTER_LONG_SIDE,
	checkLogoFile,
	isOversizedRaster,
	pngSize,
	rasterTargetSize,
	sniffLogo,
	svgIntrinsicSize
} from './logo';

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const concat = (...parts: Uint8Array[]) => {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let i = 0;
	for (const p of parts) {
		out.set(p, i);
		i += p.length;
	}
	return out;
};

const PNG_SIG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const BOM = Uint8Array.of(0xef, 0xbb, 0xbf);
const u32 = (n: number) =>
	Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
/** Signature + IHDR length (13) + 'IHDR' + width + height + bit depth/colour type etc. */
const png = (w: number, h: number, tag = 'IHDR') =>
	concat(PNG_SIG, u32(13), ascii(tag), u32(w), u32(h), Uint8Array.of(8, 6, 0, 0, 0));

describe('limits', () => {
	test('match the locked CONTEXT/RESEARCH values', () => {
		expect(LOGO_MAX_BYTES).toBe(524288);
		expect(LOGO_MAX_SIDE).toBe(4096);
		expect(RASTER_LONG_SIDE).toBe(1024);
	});
});

describe('sniffLogo', () => {
	test('PNG by magic bytes', () => {
		expect(sniffLogo(png(10, 10))).toBe('png');
		expect(sniffLogo(PNG_SIG)).toBe('png');
	});

	test('a truncated or altered PNG signature is rejected', () => {
		expect(sniffLogo(PNG_SIG.slice(0, 7))).toBeNull();
		const bad = png(10, 10);
		bad[7] = 0x0b;
		expect(sniffLogo(bad)).toBeNull();
	});

	test('plain SVG roots, case-insensitive', () => {
		expect(sniffLogo(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe('svg');
		expect(sniffLogo(ascii('<svg>'))).toBe('svg');
		expect(sniffLogo(ascii('<SVG\nwidth="1">'))).toBe('svg');
		expect(sniffLogo(ascii('  \r\n\t<svg\tviewBox="0 0 1 1"/>'))).toBe('svg');
	});

	test('BOM + <?xml prolog + comments + DOCTYPE before <svg', () => {
		const text =
			'<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: Example -->\n<!-- second -->\n' +
			'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
			'<svg width="10" height="10"></svg>';
		expect(sniffLogo(concat(BOM, ascii(text)))).toBe('svg');
		expect(sniffLogo(concat(BOM, ascii('<svg/>')))).toBe('svg');
	});

	test('JPEG, GIF, HTML, near-miss roots and empty input are rejected', () => {
		expect(sniffLogo(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46))).toBeNull();
		expect(sniffLogo(ascii('GIF89a\x01\x00\x01\x00'))).toBeNull();
		expect(sniffLogo(ascii('<html><body><svg></svg></body></html>'))).toBeNull();
		expect(sniffLogo(ascii('<!DOCTYPE html><svg>'))).toBeNull();
		expect(sniffLogo(ascii('<svgx>'))).toBeNull();
		expect(sniffLogo(ascii('<svg'))).toBeNull();
		expect(sniffLogo(ascii('<!-- unterminated <svg>'))).toBeNull();
		expect(sniffLogo(ascii('<?xml version="1.0"<svg>'))).toBeNull();
		expect(sniffLogo(new Uint8Array(0))).toBeNull();
	});

	test('the svg root must appear within the first 1024 bytes', () => {
		const pad = '<!--' + ' '.repeat(1100) + '-->';
		expect(sniffLogo(ascii(pad + '<svg>'))).toBeNull();
	});
});

describe('checkLogoFile', () => {
	test('size is checked before sniffing', () => {
		expect(checkLogoFile({ size: 524289, bytes: png(1, 1) })).toEqual({
			ok: false,
			reason: 'too-large',
			size: 524289
		});
		expect(checkLogoFile({ size: 524289, bytes: ascii('<html>') })).toEqual({
			ok: false,
			reason: 'too-large',
			size: 524289
		});
	});

	test('exactly 512 KB is allowed', () => {
		expect(checkLogoFile({ size: 524288, bytes: png(1, 1) })).toEqual({ ok: true, kind: 'png' });
	});

	test('wrong content is rejected; PNG and SVG are accepted', () => {
		expect(checkLogoFile({ size: 6, bytes: ascii('<html>') })).toEqual({
			ok: false,
			reason: 'not-png-or-svg'
		});
		expect(checkLogoFile({ size: 6, bytes: ascii('<svg/>') })).toEqual({ ok: true, kind: 'svg' });
	});
});

describe('pngSize', () => {
	test('reads big-endian IHDR width/height', () => {
		expect(pngSize(png(3000, 750))).toEqual({ width: 3000, height: 750 });
		expect(pngSize(png(70000, 1))).toEqual({ width: 70000, height: 1 });
	});

	test('null when IHDR is missing or the buffer is short', () => {
		expect(pngSize(png(10, 10, 'IDAT'))).toBeNull();
		expect(pngSize(png(10, 10).slice(0, 23))).toBeNull();
		expect(pngSize(ascii('<svg/>'))).toBeNull();
	});
});

describe('svgIntrinsicSize', () => {
	test('width/height attributes (plain or px)', () => {
		expect(svgIntrinsicSize('<svg width="200" height="100">')).toEqual({ width: 200, height: 100 });
		expect(svgIntrinsicSize("<svg height='40.5px' width='120px'/>")).toEqual({
			width: 120,
			height: 40.5
		});
	});

	test('falls back to the viewBox', () => {
		expect(svgIntrinsicSize('<svg viewBox="0 0 640 160">')).toEqual({ width: 640, height: 160 });
		expect(svgIntrinsicSize('<svg width="50%" viewBox="-10,-10, 300 , 75">')).toEqual({
			width: 300,
			height: 75
		});
	});

	test('reads the root element only, after a prolog', () => {
		expect(
			svgIntrinsicSize(
				'<?xml version="1.0"?><!-- c --><svg viewBox="0 0 64 16"><rect width="9" height="9"/></svg>'
			)
		).toEqual({ width: 64, height: 16 });
	});

	test('null when no usable size', () => {
		expect(svgIntrinsicSize('<svg width="50%">')).toBeNull();
		expect(svgIntrinsicSize('<svg width="10em" height="2em">')).toBeNull();
		expect(svgIntrinsicSize('<svg viewBox="0 0 0 10">')).toBeNull();
		expect(svgIntrinsicSize('<svg>')).toBeNull();
		expect(svgIntrinsicSize('<html>')).toBeNull();
	});
});

describe('rasterTargetSize / isOversizedRaster', () => {
	test('scales the long side to 1024 and never upscales', () => {
		expect(rasterTargetSize({ width: 3000, height: 750 })).toEqual({ width: 1024, height: 256 });
		expect(rasterTargetSize({ width: 750, height: 3000 })).toEqual({ width: 256, height: 1024 });
		expect(rasterTargetSize({ width: 400, height: 100 })).toEqual({ width: 400, height: 100 });
		expect(rasterTargetSize({ width: 5000, height: 1 })).toEqual({ width: 1024, height: 1 });
	});

	test('null for non-positive or non-finite sizes', () => {
		expect(rasterTargetSize({ width: 0, height: 10 })).toBeNull();
		expect(rasterTargetSize({ width: 10, height: -1 })).toBeNull();
		expect(rasterTargetSize({ width: Number.NaN, height: 10 })).toBeNull();
	});

	test('rasters over 4096 px on either side are oversized', () => {
		expect(isOversizedRaster({ width: 4097, height: 10 })).toBe(true);
		expect(isOversizedRaster({ width: 10, height: 4097 })).toBe(true);
		expect(isOversizedRaster({ width: 4096, height: 4096 })).toBe(false);
	});
});
