// PWA asset parity: the static manifest and the committed icons must stay correct on both bases
// (every URL relative), match the brand tokens, and have the pixel sizes they declare.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tokens } from '../packages/brand/src/index.ts';

const web = path.resolve(import.meta.dirname, '../apps/web');
const staticDir = path.join(web, 'static');

function pngSize(buf: Buffer): { width: number; height: number } {
	const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	if (buf.length < 24 || !buf.subarray(0, 8).equals(signature)) {
		throw new Error('not a PNG');
	}
	return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

type Icon = { src: string; sizes: string; type: string; purpose: string };
type Manifest = {
	name: string;
	short_name: string;
	id: string;
	start_url: string;
	scope: string;
	display: string;
	background_color: string;
	theme_color: string;
	icons: Icon[];
};

const manifestPath = path.join(staticDir, 'manifest.webmanifest');
const readManifest = (): Manifest => JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

describe('manifest.webmanifest', () => {
	it('exists and parses as JSON', () => {
		expect(existsSync(manifestPath)).toBe(true);
		expect(() => readManifest()).not.toThrow();
	});

	it('names the app and uses relative id/start_url/scope', () => {
		const m = readManifest();
		expect(m.name).toBe('Tran Real Estate Tools');
		expect(m.short_name).toBe('Tran Tools');
		expect(m.id).toBe('./');
		expect(m.start_url).toBe('./');
		expect(m.scope).toBe('./');
		expect(m.display).toBe('standalone');
	});

	it('takes its colors from the brand tokens', () => {
		const m = readManifest();
		expect(m.background_color).toBe(tokens.color.background);
		expect(m.theme_color).toBe(tokens.color.background);
	});

	it('declares exactly the three install icons with relative PNG URLs', () => {
		const m = readManifest();
		expect(m.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose }))).toEqual([
			{ src: 'icons/icon-192.png', sizes: '192x192', purpose: 'any' },
			{ src: 'icons/icon-512.png', sizes: '512x512', purpose: 'any' },
			{ src: 'icons/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' }
		]);
		for (const icon of m.icons) {
			expect(icon.type).toBe('image/png');
			expect(icon.src.startsWith('/')).toBe(false);
			expect(icon.src.startsWith('http')).toBe(false);
			expect(icon.src.startsWith('data:')).toBe(false);
		}
	});
});

describe('icon PNGs', () => {
	const expected: Array<[string, number]> = [
		['icon-192.png', 192],
		['icon-512.png', 512],
		['icon-maskable-512.png', 512],
		['apple-touch-icon-180.png', 180]
	];

	it.each(expected)('%s is a %ipx square PNG', (name, size) => {
		const file = path.join(staticDir, 'icons', name);
		expect(existsSync(file)).toBe(true);
		expect(pngSize(readFileSync(file))).toEqual({ width: size, height: size });
	});

	it('pngSize rejects a non-PNG buffer', () => {
		expect(() => pngSize(Buffer.from('not an image at all, definitely'))).toThrow('not a PNG');
	});
});

describe('generate-icons.mjs', () => {
	it('uses the current brand token colors (regenerate icons when tokens change)', () => {
		const src = readFileSync(path.join(web, 'scripts', 'generate-icons.mjs'), 'utf8');
		expect(src).toContain(tokens.color.primary);
		expect(src).toContain(tokens.color.background);
	});
});
