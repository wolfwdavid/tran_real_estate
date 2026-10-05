#!/usr/bin/env node
// Synthetic test tile: no OpenStreetMap imagery is committed (tile policy + licensing).
//
// Writes apps/web/tests/e2e/assets/tile.png: a valid 256x256 8-bit greyscale PNG filled with one
// flat grey (0xE2). Renter E2E specs answer every https://tile.openstreetmap.org/** request with
// this file through page.route, so no real tile is ever fetched. Node built-ins only; the output
// is byte-for-byte deterministic, so re-running the script never produces a diff.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZE = 256;
const GREY = 0xe2;
const OUT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../apps/web/tests/e2e/assets/tile.png'
);

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(typeAndData));
	return Buffer.concat([length, typeAndData, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); // width
ihdr.writeUInt32BE(SIZE, 4); // height
ihdr[8] = 8; // bit depth
ihdr[9] = 0; // colour type: greyscale
ihdr[10] = 0; // compression: deflate
ihdr[11] = 0; // filter method
ihdr[12] = 0; // interlace: none

// Each scanline: filter byte 0 (None), then SIZE grey samples.
const raw = Buffer.alloc((SIZE + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
	const row = y * (SIZE + 1);
	raw[row] = 0;
	raw.fill(GREY, row + 1, row + 1 + SIZE);
}

const png = Buffer.concat([
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	chunk('IHDR', ihdr),
	chunk('IDAT', deflateSync(raw, { level: 9 })),
	chunk('IEND', Buffer.alloc(0))
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`wrote ${OUT} (${png.length} bytes)`);
