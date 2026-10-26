import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const COLOR_TYPE_RGBA = 6;

/** Reads the IHDR chunk of a PNG. Throws `not a PNG` when the 8-byte signature is wrong. */
function readPngSize(buf: Uint8Array): { width: number; height: number; colorType: number } {
	if (buf.length < 26 || PNG_SIGNATURE.some((byte, i) => buf[i] !== byte)) {
		throw new Error('not a PNG');
	}
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20), colorType: buf[25] };
}

const root = join(import.meta.dirname, '..');
const ICONS = [
	['public/icon/16.png', 16],
	['public/icon/32.png', 32],
	['public/icon/48.png', 48],
	['public/icon/128.png', 128],
	['store/edge-logo-300.png', 300]
] as const;

const load = (file: string) => new Uint8Array(readFileSync(join(root, file)));

describe('extension icons', () => {
	it.each(ICONS)('%s starts with the PNG signature', (file) => {
		expect([...load(file).subarray(0, 8)]).toEqual(PNG_SIGNATURE);
	});

	it.each(ICONS)('%s is %i px square', (file, size) => {
		const { width, height } = readPngSize(load(file));
		expect({ width, height }).toEqual({ width: size, height: size });
	});

	it.each(ICONS)('%s is RGBA so its padding stays transparent', (file) => {
		expect(readPngSize(load(file)).colorType).toBe(COLOR_TYPE_RGBA);
	});

	it('readPngSize rejects a buffer that is not a PNG', () => {
		expect(() => readPngSize(new Uint8Array([0x89, 0x50]))).toThrow('not a PNG');
		expect(() => readPngSize(new Uint8Array(32))).toThrow('not a PNG');
	});
});
