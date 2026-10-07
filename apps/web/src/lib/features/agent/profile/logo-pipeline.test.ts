import { describe, expect, it, vi } from 'vitest';
import { LOGO_MAX_BYTES } from '@tran/core/agent/logo';
import { base64ToBytes, bytesToBase64, prepareLogo, type Rasterize } from './logo-pipeline';

// Node 24 has File, Blob, btoa and atob; the canvas rasterizer is injected as a fake so the
// pipeline's decisions (gate, sniff, store-vs-rasterize, retry, cap) are tested without a DOM.

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PNG signature + an IHDR chunk header carrying `width` x `height` (enough for pngSize). */
function pngHeader(width: number, height: number, pad = 8): Uint8Array<ArrayBuffer> {
	const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
	return new Uint8Array([
		...PNG_SIG,
		...u32(13),
		...'IHDR'.split('').map((c) => c.charCodeAt(0)),
		...u32(width),
		...u32(height),
		...new Array(pad).fill(0)
	]);
}

const TINY_PNG = pngHeader(2, 1);
const file = (bytes: Uint8Array<ArrayBuffer> | string, name: string) => new File([bytes], name);

/** A fake rasterizer that records its calls and returns PNGs of the given sizes in turn. */
function fakeRasterize(outputSizes: number[] = [TINY_PNG.length]) {
	const calls: { mime: string; target: { width: number; height: number } }[] = [];
	let i = 0;
	const rasterize: Rasterize = async (_bytes, mime, target) => {
		calls.push({ mime, target });
		const n = outputSizes[Math.min(i++, outputSizes.length - 1)];
		const out = new Uint8Array(n);
		out.set(TINY_PNG.subarray(0, Math.min(n, TINY_PNG.length)));
		return out;
	};
	return { calls, rasterize: vi.fn(rasterize) };
}

describe('base64 helpers', () => {
	it('round-trips 70,000 bytes including 0x00 and 0xFF', () => {
		const bytes = new Uint8Array(70_000);
		let seed = 12345;
		for (let i = 0; i < bytes.length; i++) {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			bytes[i] = seed & 0xff;
		}
		bytes[0] = 0x00;
		bytes[1] = 0xff;
		bytes[69_999] = 0xff;
		bytes[69_998] = 0x00;
		const b64 = bytesToBase64(bytes);
		expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/);
		expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
	});

	it('handles the empty array', () => {
		expect(bytesToBase64(new Uint8Array(0))).toBe('');
		expect(base64ToBytes('').length).toBe(0);
	});
});

describe('prepareLogo', () => {
	it('refuses a file over 512 KB by size before reading any of it', async () => {
		const f = file(new Uint8Array(LOGO_MAX_BYTES + 1), 'logo.png');
		const read = vi.spyOn(f, 'arrayBuffer');
		const slice = vi.spyOn(f, 'slice');
		const { rasterize } = fakeRasterize();
		const r = await prepareLogo(f, { rasterize });
		expect(r).toEqual({ ok: false, reason: 'too-large', size: 524289 });
		expect(read).not.toHaveBeenCalled();
		expect(slice).not.toHaveBeenCalled();
		expect(rasterize).not.toHaveBeenCalled();
	});

	it('accepts a file of exactly 512 KB through the size gate', async () => {
		const bytes = new Uint8Array(LOGO_MAX_BYTES);
		bytes.set(pngHeader(4, 4));
		const r = await prepareLogo(file(bytes, 'logo.png'), fakeRasterize());
		expect(r.ok).toBe(true);
	});

	it('refuses JPEG bytes by content even when named .png', async () => {
		const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
		const { rasterize } = fakeRasterize();
		const r = await prepareLogo(file(jpeg, 'logo.png'), { rasterize });
		expect(r).toEqual({ ok: false, reason: 'not-png-or-svg' });
		expect(rasterize).not.toHaveBeenCalled();
	});

	it('refuses an HTML page named .svg', async () => {
		const r = await prepareLogo(file('<html><body>hi</body></html>', 'logo.svg'), fakeRasterize());
		expect(r).toEqual({ ok: false, reason: 'not-png-or-svg' });
	});

	it('stores a PNG of at most 1024 px unchanged (no rasterization)', async () => {
		const { calls, rasterize } = fakeRasterize();
		const r = await prepareLogo(file(TINY_PNG, 'logo.png'), { rasterize });
		expect(r).toEqual({
			ok: true,
			logo: {
				base64: bytesToBase64(TINY_PNG),
				mime: 'image/png',
				width: 2,
				height: 1,
				bytes: TINY_PNG.length
			}
		});
		expect(calls).toEqual([]);
	});

	it('stores a 1024 px wide PNG unchanged but rasterizes a wider one to 1024', async () => {
		const edge = fakeRasterize();
		expect((await prepareLogo(file(pngHeader(1024, 300), 'a.png'), edge)).ok).toBe(true);
		expect(edge.calls).toEqual([]);

		const wide = fakeRasterize();
		const r = await prepareLogo(file(pngHeader(2048, 1000), 'b.png'), wide);
		expect(wide.calls).toEqual([{ mime: 'image/png', target: { width: 1024, height: 500 } }]);
		expect(r.ok && r.logo.width).toBe(1024);
		expect(r.ok && r.logo.height).toBe(500);
		expect(r.ok && r.logo.mime).toBe('image/png');
	});

	it('reports a truncated PNG as unreadable', async () => {
		const r = await prepareLogo(file(new Uint8Array(PNG_SIG), 'cut.png'), fakeRasterize());
		expect(r).toEqual({ ok: false, reason: 'unreadable' });
	});

	it('rasterizes an SVG at its viewBox size and stores only PNG', async () => {
		const svg =
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#4F6449"/></svg>';
		const { calls, rasterize } = fakeRasterize();
		const r = await prepareLogo(file(svg, 'logo.svg'), { rasterize });
		expect(calls).toEqual([{ mime: 'image/svg+xml', target: { width: 200, height: 100 } }]);
		expect(r).toEqual({
			ok: true,
			logo: {
				base64: bytesToBase64(TINY_PNG),
				mime: 'image/png',
				width: 200,
				height: 100,
				bytes: TINY_PNG.length
			}
		});
	});

	it('caps a large SVG at a 1024 px longest side and defaults an unsized one to 1024 x 512', async () => {
		const big = fakeRasterize();
		await prepareLogo(file('<svg width="4000" height="1000"></svg>', 'big.svg'), big);
		expect(big.calls[0].target).toEqual({ width: 1024, height: 256 });

		const unsized = fakeRasterize();
		await prepareLogo(file('<?xml version="1.0"?>\n<svg xmlns="x"></svg>', 'u.svg'), unsized);
		expect(unsized.calls[0].target).toEqual({ width: 1024, height: 512 });
	});

	it('retries smaller when the PNG is over the cap, then keeps the first fit', async () => {
		const over = LOGO_MAX_BYTES + 1;
		const { calls, rasterize } = fakeRasterize([over, over, 1000]);
		const r = await prepareLogo(file('<svg viewBox="0 0 800 400"></svg>', 'l.svg'), {
			rasterize
		});
		expect(calls.map((c) => c.target)).toEqual([
			{ width: 800, height: 400 },
			{ width: 600, height: 300 },
			{ width: 450, height: 225 }
		]);
		expect(r.ok && r.logo.width).toBe(450);
		expect(r.ok && r.logo.height).toBe(225);
		expect(r.ok && r.logo.bytes).toBe(1000);
	});

	it('gives up with too-large after three retries', async () => {
		const over = LOGO_MAX_BYTES + 7;
		const { calls, rasterize } = fakeRasterize([over]);
		const r = await prepareLogo(file('<svg viewBox="0 0 800 400"></svg>', 'l.svg'), {
			rasterize
		});
		expect(calls).toHaveLength(4);
		const widths = calls.map((c) => c.target.width);
		expect(widths).toEqual([...widths].sort((a, b) => b - a));
		expect(new Set(widths).size).toBe(4);
		expect(r).toEqual({ ok: false, reason: 'too-large', size: over });
	});

	it('reports a rasterizer failure as unreadable', async () => {
		const rasterize: Rasterize = async () => {
			throw new Error('decode failed');
		};
		const r = await prepareLogo(file('<svg viewBox="0 0 10 10"></svg>', 'x.svg'), { rasterize });
		expect(r).toEqual({ ok: false, reason: 'unreadable' });
	});
});
