// Agent logo pipeline (AGT-01, 08-RESEARCH Pattern 8): sniff by content, rasterize SVG (and
// oversized PNG) to PNG on a canvas, cap the result at 512 KB and hand back a StoredLogo whose
// bytes are base64 PNG. Only PNG is ever stored: an SVG blob: URL opened as a top-level document
// would run in the app's origin, which holds API keys.
//
// No data: URLs anywhere (the Phase 2 build oracle rejects them and img-src only allows blob:):
// base64 goes through chunked btoa/atob, and previews mint object URLs (logo-url.ts).
import {
	LOGO_MAX_BYTES,
	RASTER_LONG_SIDE,
	checkLogoFile,
	pngSize,
	rasterTargetSize,
	svgIntrinsicSize,
	type Size
} from '@tran/core/agent/logo';
import type { StoredLogo } from '@tran/core/agent/types';

/** Bytes read for the content sniff (the core sniffer looks at this many at most). */
const SNIFF_BYTES = 1024;
/** btoa/atob are chunked so a 512 KB logo never spreads into one giant argument list. */
const BASE64_CHUNK = 0x8000;
/** Each retry shrinks both sides to this fraction when the PNG is still over the cap. */
const RETRY_SCALE = 0.75;
const MAX_RETRIES = 3;
/** Canvas size for an SVG that declares neither width/height nor a viewBox. */
const SVG_DEFAULT_SIZE: Size = { width: RASTER_LONG_SIDE, height: RASTER_LONG_SIDE / 2 };

export type LogoResult =
	| { ok: true; logo: StoredLogo }
	| { ok: false; reason: 'too-large'; size: number }
	| { ok: false; reason: 'not-png-or-svg' }
	| { ok: false; reason: 'unreadable' };

export type LogoMime = 'image/png' | 'image/svg+xml';

/** Draws `bytes` (PNG or SVG) at `target` and returns PNG bytes. The default uses a canvas. */
export type Rasterize = (
	bytes: Uint8Array<ArrayBuffer>,
	mime: LogoMime,
	target: Size
) => Promise<Uint8Array<ArrayBuffer>>;

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
	}
	return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
	const binary = atob(b64);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}

/** Browser rasterizer: Blob -> object URL -> decoded <img> -> canvas -> PNG blob -> bytes. */
async function rasterizeOnCanvas(
	bytes: Uint8Array<ArrayBuffer>,
	mime: LogoMime,
	target: Size
): Promise<Uint8Array<ArrayBuffer>> {
	const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
	try {
		const img = new Image();
		img.decoding = 'async';
		img.src = url;
		await img.decode();
		const canvas = document.createElement('canvas');
		canvas.width = target.width;
		canvas.height = target.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('no-2d-context');
		ctx.drawImage(img, 0, 0, target.width, target.height);
		const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
		if (!png) throw new Error('encode-failed');
		return new Uint8Array(await png.arrayBuffer());
	} finally {
		URL.revokeObjectURL(url);
	}
}

const shrink = (s: Size): Size => ({
	width: Math.max(1, Math.round(s.width * RETRY_SCALE)),
	height: Math.max(1, Math.round(s.height * RETRY_SCALE))
});

const stored = (png: Uint8Array, size: Size): StoredLogo => ({
	base64: bytesToBase64(png),
	mime: 'image/png',
	width: size.width,
	height: size.height,
	bytes: png.length
});

/** Rasterizes at `target`, retrying smaller while the PNG is over the cap. */
async function rasterizeCapped(
	rasterize: Rasterize,
	bytes: Uint8Array<ArrayBuffer>,
	mime: LogoMime,
	target: Size
): Promise<LogoResult> {
	let size = target;
	let png: Uint8Array<ArrayBuffer>;
	try {
		png = await rasterize(bytes, mime, size);
		for (let retry = 0; png.length > LOGO_MAX_BYTES && retry < MAX_RETRIES; retry++) {
			size = shrink(size);
			png = await rasterize(bytes, mime, size);
		}
	} catch {
		return { ok: false, reason: 'unreadable' };
	}
	if (png.length > LOGO_MAX_BYTES) return { ok: false, reason: 'too-large', size: png.length };
	return { ok: true, logo: stored(png, size) };
}

/**
 * Turns a chosen file into a StoredLogo. The size gate and content sniff run on the first KB
 * before the whole file is read; a PNG with a longest side of at most 1024 px is stored as-is,
 * anything else is drawn to a PNG with a longest side of 1024 px (never upscaled).
 */
export async function prepareLogo(
	file: File,
	deps: { rasterize?: Rasterize } = {}
): Promise<LogoResult> {
	const rasterize = deps.rasterize ?? rasterizeOnCanvas;

	// Too-large files are refused by size alone: nothing of them is read.
	const head =
		file.size > LOGO_MAX_BYTES
			? new Uint8Array(0)
			: new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
	const check = checkLogoFile({ size: file.size, bytes: head });
	if (!check.ok) return check;

	const bytes = new Uint8Array(await file.arrayBuffer());

	if (check.kind === 'png') {
		const size = pngSize(bytes);
		if (!size) return { ok: false, reason: 'unreadable' };
		if (Math.max(size.width, size.height) <= RASTER_LONG_SIDE) {
			return { ok: true, logo: stored(bytes, size) };
		}
		const target = rasterTargetSize(size);
		if (!target) return { ok: false, reason: 'unreadable' };
		return rasterizeCapped(rasterize, bytes, 'image/png', target);
	}

	const intrinsic = svgIntrinsicSize(new TextDecoder().decode(bytes)) ?? SVG_DEFAULT_SIZE;
	const target = rasterTargetSize(intrinsic) ?? SVG_DEFAULT_SIZE;
	return rasterizeCapped(rasterize, bytes, 'image/svg+xml', target);
}
