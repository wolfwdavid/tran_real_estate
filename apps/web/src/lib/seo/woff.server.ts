import { inflateSync } from 'node:zlib';

/**
 * WOFF 1.0 (W3C, section 5) -> SFNT (TTF/OTF). resvg/fontdb reads TTF/OTF only, and Fontsource
 * ships WOFF/WOFF2. This is the one deliberate hand-roll (RESEARCH "Don't Hand-Roll"): WOFF 1.0 is a
 * frozen format of a header plus zlib-compressed tables. Guarded by woff.server.test.ts (signature,
 * table count, total size, readable `name` table) and the share-card dark-pixel test.
 */
export function woffToSfnt(woff: Buffer): Buffer {
	if (woff.length < 44 || woff.toString('ascii', 0, 4) !== 'wOFF') {
		throw new Error('not a WOFF 1.0 file (WOFF2 is unsupported)');
	}
	const flavor = woff.readUInt32BE(4);
	const n = woff.readUInt16BE(12);
	const tables = Array.from({ length: n }, (_, i) => {
		const o = 44 + i * 20;
		const tag = woff.readUInt32BE(o);
		const off = woff.readUInt32BE(o + 4);
		const comp = woff.readUInt32BE(o + 8);
		const orig = woff.readUInt32BE(o + 12);
		const checksum = woff.readUInt32BE(o + 16);
		const raw = woff.subarray(off, off + comp);
		return { tag, checksum, data: comp < orig ? inflateSync(raw) : raw };
	});
	let size = 12 + 16 * n;
	const offsets = tables.map((t) => {
		const at = size;
		size += (t.data.length + 3) & ~3;
		return at;
	});
	const out = Buffer.alloc(size);
	const es = Math.floor(Math.log2(n));
	const sr = 16 * 2 ** es;
	out.writeUInt32BE(flavor, 0);
	out.writeUInt16BE(n, 4);
	out.writeUInt16BE(sr, 6);
	out.writeUInt16BE(es, 8);
	out.writeUInt16BE(n * 16 - sr, 10);
	tables.forEach((t, i) => {
		const o = 12 + 16 * i;
		out.writeUInt32BE(t.tag, o);
		out.writeUInt32BE(t.checksum, o + 4);
		out.writeUInt32BE(offsets[i], o + 8);
		out.writeUInt32BE(t.data.length, o + 12);
		t.data.copy(out, offsets[i]);
	});
	return out;
}

const NAME_TAG = 0x6e616d65; // 'name'

/**
 * The font family (name table, nameID 1) of an SFNT. Prefers the Windows platform (3, UTF-16BE),
 * falls back to Macintosh (1, single-byte). resvg matches `font-family` against this value.
 */
export function nameFamily(sfnt: Buffer): string {
	const numTables = sfnt.readUInt16BE(4);
	let table = -1;
	for (let i = 0; i < numTables; i++) {
		if (sfnt.readUInt32BE(12 + 16 * i) === NAME_TAG) table = sfnt.readUInt32BE(12 + 16 * i + 8);
	}
	if (table < 0) throw new Error('font has no name table');
	const count = sfnt.readUInt16BE(table + 2);
	const strings = table + sfnt.readUInt16BE(table + 4);
	let mac: string | undefined;
	for (let r = 0; r < count; r++) {
		const rec = table + 6 + r * 12;
		const platform = sfnt.readUInt16BE(rec);
		const nameId = sfnt.readUInt16BE(rec + 6);
		if (nameId !== 1) continue;
		const length = sfnt.readUInt16BE(rec + 8);
		const start = strings + sfnt.readUInt16BE(rec + 10);
		const bytes = sfnt.subarray(start, start + length);
		if (platform === 3) return Buffer.from(bytes).swap16().toString('utf16le');
		if (platform === 1 && mac === undefined) mac = bytes.toString('latin1');
	}
	if (mac !== undefined) return mac;
	throw new Error('font has no family name (nameID 1)');
}
