// CSV byte decoding (08-20, AGT-07): strict UTF-8 first, Excel's windows-1252 as the fallback.
import { describe, expect, it } from 'vitest';
import { decodeCsvBytes } from './decode';

const utf8 = (s: string): ArrayBuffer => {
	const bytes = new TextEncoder().encode(s);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

describe('decodeCsvBytes', () => {
	it('decodes UTF-8 and drops a leading BOM', () => {
		const r = decodeCsvBytes(utf8('﻿Name,Email\r\nJosé,jose@example.com\r\n'));
		expect(r.encoding).toBe('utf-8');
		expect(r.text).toBe('Name,Email\r\nJosé,jose@example.com\r\n');
		expect(r.text.charCodeAt(0)).not.toBe(0xfeff);
	});

	it('decodes plain UTF-8 without a BOM unchanged', () => {
		const r = decodeCsvBytes(utf8('a,b\r\n1,2\r\n'));
		expect(r).toEqual({ text: 'a,b\r\n1,2\r\n', encoding: 'utf-8' });
	});

	it('falls back to windows-1252 when the bytes are not valid UTF-8', () => {
		const r = decodeCsvBytes(new Uint8Array([0x4a, 0x6f, 0x73, 0xe9]).buffer);
		expect(r).toEqual({ text: 'José', encoding: 'windows-1252' });
	});

	it('maps the windows-1252 upper range (not latin-1) in the fallback', () => {
		// 0x93 / 0x94 are curly quotes in windows-1252 and C1 controls in latin-1.
		const r = decodeCsvBytes(new Uint8Array([0x93, 0x41, 0x94, 0xe9]).buffer);
		expect(r.encoding).toBe('windows-1252');
		expect(r.text).toBe('“A”é');
	});

	it('accepts a typed-array view as well as an ArrayBuffer', () => {
		const r = decodeCsvBytes(new Uint8Array([0x61, 0x2c, 0x62]));
		expect(r).toEqual({ text: 'a,b', encoding: 'utf-8' });
	});

	it('returns empty text for an empty file', () => {
		expect(decodeCsvBytes(new ArrayBuffer(0))).toEqual({ text: '', encoding: 'utf-8' });
	});
});
