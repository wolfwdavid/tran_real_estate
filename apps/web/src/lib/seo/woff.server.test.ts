import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
import { OG_FONT_FAMILY } from './og-card.server.js';
import { nameFamily, woffToSfnt } from './woff.server.js';

const req = createRequire(import.meta.url);
const woff = (spec: string) => readFileSync(req.resolve(spec));

const FRAUNCES_600 = woff('@fontsource/fraunces/files/fraunces-latin-600-normal.woff');
const INTER_400 = woff('@fontsource/inter/files/inter-latin-400-normal.woff');
const INTER_600 = woff('@fontsource/inter/files/inter-latin-600-normal.woff');

const SFNT_SIGNATURES = [0x00010000, 0x4f54544f]; // TrueType 1.0, 'OTTO'

describe('woffToSfnt', () => {
	test.each([
		['fraunces 600', FRAUNCES_600],
		['inter 400', INTER_400],
		['inter 600', INTER_600]
	])('%s converts to a structurally valid SFNT', (_name, source) => {
		const sfnt = woffToSfnt(source);
		expect(SFNT_SIGNATURES).toContain(sfnt.readUInt32BE(0));
		const numTables = sfnt.readUInt16BE(4);
		expect(numTables).toBe(source.readUInt16BE(12));
		expect(numTables).toBeGreaterThan(5);
		// The WOFF header records the total uncompressed SFNT size; ours must match it exactly.
		expect(sfnt.length).toBe(source.readUInt32BE(16));
		for (let i = 0; i < numTables; i++) {
			const entry = 12 + 16 * i;
			const offset = sfnt.readUInt32BE(entry + 8);
			const length = sfnt.readUInt32BE(entry + 12);
			expect(offset % 4).toBe(0);
			expect(offset + length).toBeLessThanOrEqual(sfnt.length);
		}
	});

	test('reads the family names the share card depends on', () => {
		expect(nameFamily(woffToSfnt(FRAUNCES_600))).toBe('Fraunces SemiBold');
		expect(nameFamily(woffToSfnt(INTER_400))).toBe('Inter');
		const inter600 = nameFamily(woffToSfnt(INTER_600));
		expect(inter600).toMatch(/^Inter/);
		expect(inter600).toBe(OG_FONT_FAMILY.bodySemibold);
		expect(OG_FONT_FAMILY.display).toBe('Fraunces SemiBold');
		expect(OG_FONT_FAMILY.body).toBe('Inter');
	});

	test('rejects WOFF2 and anything that is not WOFF 1.0', () => {
		expect(() => woffToSfnt(Buffer.from('wOF2....'.padEnd(64, '\0')))).toThrow(
			/WOFF2 is unsupported|not a WOFF 1.0/
		);
		expect(() => woffToSfnt(Buffer.from('not a font at all'))).toThrow(/not a WOFF 1.0/);
	});
});
