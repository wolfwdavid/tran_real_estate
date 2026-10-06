/**
 * Agent logo validation (08-RESEARCH Pattern 8). Pure and DOM-free: works on `Uint8Array` and
 * strings only (core has no DOM lib, so no text-decoder or file-object APIs).
 *
 * The file type is decided by content, never by `file.type` or the extension, so a renamed
 * HTML page or JPEG can never be stored as a logo.
 *
 * SVGs are rasterized to PNG on upload (web plan 08-22) because an SVG `blob:` URL opened as a
 * top-level document ("Open image in new tab") runs in the app's origin, which holds API keys.
 * Only PNG is ever stored; these helpers size that rasterization.
 */

export type LogoKind = 'png' | 'svg';
export type Size = { width: number; height: number };

/** 512 KB (locked in CONTEXT). */
export const LOGO_MAX_BYTES = 524288;
/** Rasters wider or taller than this are rejected. */
export const LOGO_MAX_SIDE = 4096;
/** Longest side of the PNG produced when rasterizing an SVG. */
export const RASTER_LONG_SIDE = 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;
/** Only the head of the file is decoded when looking for the `<svg` root. */
const SVG_SNIFF_BYTES = 1024;

const startsWithBytes = (bytes: Uint8Array, sig: readonly number[], at = 0) =>
	bytes.length >= at + sig.length && sig.every((b, i) => bytes[at + i] === b);

/** Latin-1 decode of `bytes[from, to)`: enough for ASCII markup, no DOM decoder needed. */
function asciiSlice(bytes: Uint8Array, from: number, to: number): string {
	let s = '';
	for (let i = from; i < Math.min(to, bytes.length); i++) s += String.fromCharCode(bytes[i]);
	return s;
}

const WS = /\s/;

function skipWs(text: string, i: number): number {
	while (i < text.length && WS.test(text[i])) i++;
	return i;
}

/**
 * Index of the `<svg` root in `text`, allowing leading whitespace, one `<?xml …?>` prolog, any
 * number of `<!-- … -->` comments and one `<!DOCTYPE svg …>` (with optional internal subset).
 * Null if anything else comes first or a construct is unterminated.
 */
function svgRootIndex(text: string): number | null {
	let i = skipWs(text, 0);
	if (text.startsWith('<?xml', i)) {
		const end = text.indexOf('?>', i);
		if (end < 0) return null;
		i = skipWs(text, end + 2);
	}
	let doctypeSeen = false;
	for (;;) {
		if (text.startsWith('<!--', i)) {
			const end = text.indexOf('-->', i + 4);
			if (end < 0) return null;
			i = skipWs(text, end + 3);
		} else if (!doctypeSeen && /^<!doctype\s+svg[\s>[]/i.test(text.slice(i, i + 14))) {
			const bracket = text.indexOf('[', i);
			const close = text.indexOf('>', i);
			if (close < 0) return null;
			if (bracket >= 0 && bracket < close) {
				const subsetEnd = text.indexOf(']', bracket);
				if (subsetEnd < 0) return null;
				const after = text.indexOf('>', subsetEnd);
				if (after < 0) return null;
				i = skipWs(text, after + 1);
			} else {
				i = skipWs(text, close + 1);
			}
			doctypeSeen = true;
		} else {
			break;
		}
	}
	// `<svg` must be followed by whitespace, `>` or `/` (so `<svgx>` and a bare `<svg` fail).
	return /^<svg[\s>/]/i.test(text.slice(i, i + 5)) ? i : null;
}

/** 'png' | 'svg' by content, or null for anything else (JPEG, GIF, HTML, empty…). */
export function sniffLogo(bytes: Uint8Array): LogoKind | null {
	if (startsWithBytes(bytes, PNG_SIGNATURE)) return 'png';
	const from = startsWithBytes(bytes, UTF8_BOM) ? UTF8_BOM.length : 0;
	const head = asciiSlice(bytes, from, from + SVG_SNIFF_BYTES);
	return svgRootIndex(head) === null ? null : 'svg';
}

export type LogoCheck =
	| { ok: true; kind: LogoKind }
	| { ok: false; reason: 'too-large'; size: number }
	| { ok: false; reason: 'not-png-or-svg' };

/** Size gate first (cheap, and no need to read a huge file), then the content sniff. */
export function checkLogoFile(file: { size: number; bytes: Uint8Array }): LogoCheck {
	if (file.size > LOGO_MAX_BYTES) return { ok: false, reason: 'too-large', size: file.size };
	const kind = sniffLogo(file.bytes);
	return kind ? { ok: true, kind } : { ok: false, reason: 'not-png-or-svg' };
}

const readU32BE = (b: Uint8Array, at: number) =>
	((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

/** PNG width/height from the IHDR chunk (always first: bytes 12-15 'IHDR', 16 width, 20 height). */
export function pngSize(bytes: Uint8Array): Size | null {
	if (bytes.length < 24 || !startsWithBytes(bytes, PNG_SIGNATURE)) return null;
	if (asciiSlice(bytes, 12, 16) !== 'IHDR') return null;
	return { width: readU32BE(bytes, 16), height: readU32BE(bytes, 20) };
}

const LENGTH = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(?:px)?\s*$/i;

function positiveLength(raw: string | undefined): number | null {
	if (raw === undefined) return null;
	const m = LENGTH.exec(raw);
	if (!m) return null;
	const n = Number(m[1]);
	return n > 0 && Number.isFinite(n) ? n : null;
}

/**
 * Intrinsic size of the root `<svg>`: `width`/`height` when both are plain numbers or px,
 * otherwise the viewBox width/height, otherwise null (the UI then asks for a different file).
 */
export function svgIntrinsicSize(text: string): Size | null {
	const start = svgRootIndex(text);
	if (start === null) return null;
	const end = text.indexOf('>', start);
	const tag = end < 0 ? text.slice(start) : text.slice(start, end);
	const attrs: Record<string, string> = {};
	for (const m of tag.matchAll(/\s(width|height|viewBox)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
		const name = m[1].toLowerCase();
		if (!(name in attrs)) attrs[name] = m[2] ?? m[3];
	}
	const width = positiveLength(attrs.width);
	const height = positiveLength(attrs.height);
	if (width !== null && height !== null) return { width, height };

	const parts = (attrs.viewbox ?? '').trim().split(/[\s,]+/);
	if (parts.length !== 4) return null;
	const [vw, vh] = [Number(parts[2]), Number(parts[3])];
	return vw > 0 && vh > 0 && Number.isFinite(vw) && Number.isFinite(vh)
		? { width: vw, height: vh }
		: null;
}

/** Canvas size for rasterizing: longest side 1024, aspect kept, never upscaled. */
export function rasterTargetSize(size: Size): Size | null {
	const { width, height } = size;
	if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return null;
	const scale = Math.min(1, RASTER_LONG_SIDE / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

/** PNGs over 4096 px on either side are rejected. */
export function isOversizedRaster(size: Size): boolean {
	return size.width > LOGO_MAX_SIDE || size.height > LOGO_MAX_SIDE;
}
