// Negative-first tests for scripts/extension-release-checks.mjs (EXT-05, EXT-06, EXT-08).
// No network, no timers: the probe takes an injected fetch, git runs in a temp repo, zips are
// synthetic. Nothing is written into the repository.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import {
	checkAncestor,
	checkVersions,
	extractNotes,
	probePrivacyUrl,
	summarize
} from './extension-release-checks.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(REPO_ROOT, 'scripts', 'extension-release-checks.mjs');

function withTmp<T>(fn: (root: string) => T): T {
	const root = mkdtempSync(join(tmpdir(), 'ext-release-'));
	try {
		return fn(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

/** A minimal STORED (uncompressed) zip: local headers, central directory, EOCD. */
function makeZip(entries: Array<[string, string]>): Buffer {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;
	for (const [name, text] of entries) {
		const nameBuf = Buffer.from(name, 'utf8');
		const data = Buffer.from(text, 'utf8');
		const crc = crc32(data);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(nameBuf.length, 26);
		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(nameBuf.length, 28);
		central.writeUInt32LE(offset, 42);
		locals.push(local, nameBuf, data);
		centrals.push(central, nameBuf);
		offset += local.length + nameBuf.length + data.length;
	}
	const cd = Buffer.concat(centrals);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(entries.length, 8);
	eocd.writeUInt16LE(entries.length, 10);
	eocd.writeUInt32LE(cd.length, 12);
	eocd.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, cd, eocd]);
}

describe('checkVersions', () => {
	const ok = {
		tag: 'ext-v0.1.0',
		packageVersion: '0.1.0',
		manifestVersion: '0.1.0',
		zipNames: ['sponsored-listing-filter-0.1.0-chrome.zip']
	};

	test('all four agree', () => {
		expect(checkVersions(ok)).toEqual([]);
	});

	test('mismatching tag names both values', () => {
		const p = checkVersions({ ...ok, tag: 'ext-v0.1.1' });
		expect(p).toHaveLength(1);
		expect(p[0]).toContain('ext-v0.1.1');
		expect(p[0]).toContain('0.1.0');
	});

	test.each(['ext-v1.0', 'v0.1.0', 'ext-v0.1.0; rm -rf /'])('malformed tag %s fails', (tag) => {
		expect(checkVersions({ ...ok, tag }).join('\n')).toContain('does not match ext-vX.Y.Z');
	});

	test('manifest 0.1.1 against package 0.1.0 fails', () => {
		const p = checkVersions({ ...ok, manifestVersion: '0.1.1' });
		expect(p).toHaveLength(1);
		expect(p[0]).toContain('0.1.1');
	});

	test('zip named for 0.1.1 against package 0.1.0 fails', () => {
		const p = checkVersions({ ...ok, zipNames: ['sponsored-listing-filter-0.1.1-chrome.zip'] });
		expect(p.join('\n')).toContain('-0.1.0-chrome.zip');
	});

	test('two zips fail', () => {
		const p = checkVersions({
			...ok,
			zipNames: [
				'sponsored-listing-filter-0.1.0-chrome.zip',
				'sponsored-listing-filter-0.1.1-chrome.zip'
			]
		});
		expect(p).toHaveLength(1);
	});

	test('no zip fails', () => {
		expect(checkVersions({ ...ok, zipNames: [] }).join('\n')).toContain('none');
	});

	test('an empty tag (dry-run) skips only the tag checks', () => {
		expect(checkVersions({ ...ok, tag: '' })).toEqual([]);
		expect(checkVersions({ ...ok, tag: undefined, manifestVersion: '9.9.9' })).toHaveLength(1);
	});
});

describe('checkAncestor (temp git repo)', () => {
	const ID = [
		'-c',
		'commit.gpgsign=false',
		'-c',
		'user.name=t',
		'-c',
		'user.email=t@example.invalid'
	];
	const git = (cwd: string, ...args: string[]) => {
		const r = spawnSync('git', [...ID, ...args], { cwd, encoding: 'utf8' });
		if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
	};
	const repo = (root: string) => {
		git(root, 'init', '-b', 'main');
		git(root, 'commit', '--allow-empty', '-m', 'one');
		git(root, 'commit', '--allow-empty', '-m', 'two');
	};

	test('HEAD on main passes against main', () => {
		withTmp((root) => {
			repo(root);
			expect(checkAncestor({ ref: 'main', cwd: root })).toEqual([]);
		});
	});

	test('HEAD on a side branch fails: not an ancestor', () => {
		withTmp((root) => {
			repo(root);
			git(root, 'checkout', '-b', 'side');
			git(root, 'commit', '--allow-empty', '-m', 'side only');
			const p = checkAncestor({ ref: 'main', cwd: root });
			expect(p).toHaveLength(1);
			expect(p[0]).toContain('not an ancestor of main');
		});
	});

	test('an unresolvable origin/main fails closed with the fetch-depth hint', () => {
		withTmp((root) => {
			repo(root);
			const p = checkAncestor({ cwd: root });
			expect(p).toHaveLength(1);
			expect(p[0]).toContain('fetch-depth');
		});
	});
});

describe('probePrivacyUrl', () => {
	const stub = (status: number, body: string) => {
		const urls: string[] = [];
		const fetchImpl = (async (url: string) => {
			urls.push(url);
			return new Response(body, { status });
		}) as unknown as typeof fetch;
		return { urls, fetchImpl };
	};
	const SITE = 'https://example.invalid/base';

	test('200 with the anchor passes and requests the trailing-slash URL', async () => {
		const s = stub(200, '<h2 id="browser-extension">x</h2>');
		expect(await probePrivacyUrl({ siteUrl: SITE, fetchImpl: s.fetchImpl })).toEqual([]);
		expect(s.urls[0]).toBe(`${SITE}/legal/privacy/`);
	});

	test('404 with the anchor fails', async () => {
		const s = stub(404, '<h2 id="browser-extension">x</h2>');
		const p = await probePrivacyUrl({ siteUrl: SITE, fetchImpl: s.fetchImpl });
		expect(p.join('\n')).toContain('404');
	});

	test('200 without the anchor fails', async () => {
		const s = stub(200, '<h2>nothing here</h2>');
		const p = await probePrivacyUrl({ siteUrl: SITE, fetchImpl: s.fetchImpl });
		expect(p.join('\n')).toContain('anchor');
	});

	test('a rejected fetch is a problem, not a throw', async () => {
		const fetchImpl = (async () => {
			throw new Error('boom');
		}) as unknown as typeof fetch;
		const p = await probePrivacyUrl({ siteUrl: SITE, fetchImpl });
		expect(p.join('\n')).toContain('boom');
	});
});

describe('extractNotes', () => {
	const log = [
		'# Changelog',
		'',
		'## [Unreleased]',
		'',
		'## [0.1.0] - 2026-11-16',
		'',
		'### Added',
		'',
		'- one thing',
		'',
		'## [0.0.9] - 2026-01-01',
		'',
		'- old',
		'',
		'[Unreleased]: https://example.invalid/compare/ext-v0.1.0...HEAD',
		'[0.1.0]: https://example.invalid/releases/tag/ext-v0.1.0',
		''
	].join('\n');

	test('returns the section body only', () => {
		const n = extractNotes(log, '0.1.0');
		expect(n).toBe('### Added\n\n- one thing');
		expect(n).not.toContain('old');
	});

	test('a final section followed by link references drops those lines', () => {
		const n = extractNotes(log, '0.0.9');
		expect(n).toBe('- old');
		expect(n).not.toMatch(/^\[[^\]]+\]: /m);
	});

	test('a missing version throws', () => {
		expect(() => extractNotes(log, '0.2.0')).toThrow(/no "## \[0\.2\.0\]/);
	});

	test('an empty section throws', () => {
		expect(() =>
			extractNotes('## [0.1.0] - 2026-11-16\n\n## [0.0.1] - 2026-01-01\n- x', '0.1.0')
		).toThrow(/empty/);
	});

	test('a bad date throws', () => {
		expect(() => extractNotes('## [0.1.0] - soon\n\n- x\n', '0.1.0')).toThrow(/YYYY-MM-DD/);
	});

	test('the version is regex-escaped (0.1.0 does not match 0x1y0)', () => {
		expect(() => extractNotes('## [0x1y0] - 2026-11-16\n\n- x\n', '0.1.0')).toThrow();
	});
});

describe('summarize', () => {
	test('lists name, size, entry count and the sums in a fence', () => {
		withTmp((root) => {
			const zip = join(root, 'sponsored-listing-filter-0.1.0-chrome.zip');
			const buf = makeZip([
				['manifest.json', '{}'],
				['popup.html', '']
			]);
			writeFileSync(zip, buf);
			const sums = join(root, 'SHA256SUMS.txt');
			writeFileSync(sums, 'abc123  sponsored-listing-filter-0.1.0-chrome.zip\n');
			const md = summarize({ zipPath: zip, sumsPath: sums });
			expect(md).toContain('sponsored-listing-filter-0.1.0-chrome.zip');
			expect(md).toContain(`Size: ${buf.length} bytes`);
			expect(md).toContain('Entries: 2');
			expect(md).toContain('```\nabc123  sponsored-listing-filter-0.1.0-chrome.zip\n```');
		});
	});
});

describe('CLI version', () => {
	const run = (pkgV: string, manV: string, zipV: string) =>
		withTmp((root) => {
			const pkg = join(root, 'package.json');
			const man = join(root, 'manifest.json');
			const zd = join(root, 'out');
			mkdirSync(zd);
			writeFileSync(pkg, JSON.stringify({ version: pkgV }));
			writeFileSync(man, JSON.stringify({ version: manV }));
			writeFileSync(join(zd, `sponsored-listing-filter-${zipV}-chrome.zip`), '');
			return spawnSync(
				process.execPath,
				[CLI, 'version', '--package', pkg, '--manifest', man, '--zip-dir', zd],
				{ encoding: 'utf8', env: { ...process.env, RELEASE_TAG: '' } }
			);
		});

	test('a mismatch exits 1', () => {
		const r = run('0.1.0', '0.1.1', '0.1.0');
		expect(r.status).toBe(1);
		expect(r.stderr).toContain('Release check failed');
	});

	test('a match exits 0', () => {
		const r = run('0.1.0', '0.1.0', '0.1.0');
		expect(r.status).toBe(0);
		expect(r.stdout).toContain('versions agree: 0.1.0');
	});

	test('an unknown command exits 2', () => {
		expect(spawnSync(process.execPath, [CLI, 'nope'], { encoding: 'utf8' }).status).toBe(2);
	});
});
