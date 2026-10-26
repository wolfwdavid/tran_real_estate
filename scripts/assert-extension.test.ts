// Mutation tests for scripts/assert-extension.mjs (EXT-03 build-output layer). A golden
// production-shaped extension output is generated at runtime under os.tmpdir(); every protection
// the oracle claims is proven by planting exactly one fault and asserting the oracle names it.
// Nothing is written into the repository.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import {
	EXPECTED_PERMISSIONS,
	URL_ALLOWLIST,
	checkManifest,
	checkOutput,
	checkZip,
	listZipEntries,
	scanBundle
} from './assert-extension.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(REPO_ROOT, 'scripts', 'assert-extension.mjs');

const ZILLOW = '*://*.zillow.com/*';
const CSP =
	"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

type Manifest = Record<string, unknown> & {
	content_scripts: Array<Record<string, unknown>>;
	content_security_policy?: { extension_pages: string };
	background: Record<string, unknown>;
	permissions: string[];
	host_permissions: string[];
};

const goldenManifest = (): Manifest => ({
	manifest_version: 3,
	name: 'Sponsored Listing Filter — for Zillow',
	short_name: 'Sponsored Filter',
	description:
		'Dims sponsored listing cards in Zillow search results. Show any card with one click. Collects nothing, sends nothing.',
	version: '0.1.0',
	icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
	permissions: ['storage'],
	host_permissions: [ZILLOW],
	action: {
		default_title: 'Sponsored Listing Filter',
		default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' },
		default_popup: 'popup.html'
	},
	content_security_policy: { extension_pages: CSP },
	background: { service_worker: 'background.js' },
	content_scripts: [
		{
			matches: [ZILLOW],
			run_at: 'document_idle',
			js: ['content-scripts/zillow.js'],
			css: ['content-scripts/zillow.css']
		}
	]
});

// Bundle text with the URL shapes a real Svelte/WXT build legitimately carries.
const goldenFiles = (): Record<string, string | Buffer> => ({
	'popup.html':
		'<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/chunks/popup-x.js"></script></head><body><div id="app"></div></body></html>',
	'chunks/popup-x.js': [
		'const NS = "http://www.w3.org/2000/svg";',
		'const XL = "http://www.w3.org/1999/xlink";',
		'const XH = "http://www.w3.org/1999/xhtml";',
		'const MM = "http://www.w3.org/1998/Math/MathML";',
		'const E = "https://svelte.dev/e/each_key_duplicate";',
		'const P = "https://tranrealestate.github.io/legal/privacy/#browser-extension";',
		'export { NS, XL, XH, MM, E, P };'
	].join('\n'),
	'content-scripts/zillow.js': 'document.querySelectorAll("article").forEach((a) => a.remove);',
	'content-scripts/zillow.css': '.slf-dim{opacity:.35}',
	'background.js': 'chrome.action.setBadgeText({ text: "" });',
	'icon/16.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
	'icon/32.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
	'icon/48.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
	'icon/128.png': Buffer.from([0x89, 0x50, 0x4e, 0x47])
});

type Fixture = { manifest: Manifest; files: Record<string, string | Buffer> };

function writeOutput(root: string, name: string, fx: Fixture): string {
	const dir = join(root, name);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'manifest.json'), JSON.stringify(fx.manifest, null, 2));
	for (const [rel, body] of Object.entries(fx.files)) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true });
		writeFileSync(join(dir, rel), body);
	}
	return dir;
}

function withTmp<T>(fn: (root: string) => T): T {
	const root = mkdtempSync(join(tmpdir(), 'ext-oracle-'));
	try {
		return fn(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

const golden = (): Fixture => ({ manifest: goldenManifest(), files: goldenFiles() });

/** Runs checkOutput on the golden output after `mutate` plants one fault. */
const problemsAfter = (mutate: (fx: Fixture) => void): string[] =>
	withTmp((root) => {
		const fx = golden();
		mutate(fx);
		return checkOutput(writeOutput(root, 'chrome-mv3', fx));
	});

const appendJs = (text: string) => (fx: Fixture) => {
	fx.files['chunks/popup-x.js'] += `\n${text}`;
};
const appendCss = (text: string) => (fx: Fixture) => {
	fx.files['content-scripts/zillow.css'] += `\n${text}`;
};

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

const runCli = (...args: string[]) =>
	spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

describe('assert-extension oracle: golden output', () => {
	test('golden output has zero problems', () => {
		expect(problemsAfter(() => {})).toEqual([]);
	});

	test('CLI passes on the golden output and reports the scan size', () => {
		withTmp((root) => {
			const dir = writeOutput(root, 'chrome-mv3', golden());
			const r = runCli(dir);
			expect(r.stderr).toBe('');
			expect(r.status).toBe(0);
			expect(r.stdout).toContain('Extension oracle passed (');
		});
	});

	test('the exported constants are the locked contract', () => {
		expect(EXPECTED_PERMISSIONS).toEqual(['storage']);
		expect(URL_ALLOWLIST).toContain('https://svelte.dev/e/');
		expect(URL_ALLOWLIST).toContain('https://tranrealestate.github.io/');
	});
});

describe('assert-extension oracle: planted manifest faults', () => {
	test.each<[string, (fx: Fixture) => void, string]>([
		['permissions + tabs', (fx) => fx.manifest.permissions.push('tabs'), 'permissions'],
		['permissions + scripting', (fx) => fx.manifest.permissions.push('scripting'), 'permissions'],
		[
			"host_permissions + '<all_urls>'",
			(fx) => fx.manifest.host_permissions.push('<all_urls>'),
			'host_permissions'
		],
		[
			'host_permissions + https://*/*',
			(fx) => fx.manifest.host_permissions.push('https://*/*'),
			'host_permissions'
		],
		[
			'web_accessible_resources present',
			(fx) => {
				fx.manifest.web_accessible_resources = [{ resources: ['x.js'], matches: [ZILLOW] }];
			},
			'web_accessible_resources'
		],
		[
			'optional_permissions present',
			(fx) => {
				fx.manifest.optional_permissions = ['tabs'];
			},
			'optional_permissions'
		],
		[
			'optional_host_permissions present',
			(fx) => {
				fx.manifest.optional_host_permissions = ['https://*/*'];
			},
			'optional_host_permissions'
		],
		[
			'externally_connectable present',
			(fx) => {
				fx.manifest.externally_connectable = { matches: ['https://x.test/*'] };
			},
			'externally_connectable'
		],
		[
			'unknown top-level surface (side_panel)',
			(fx) => {
				fx.manifest.side_panel = { default_path: 'panel.html' };
			},
			'side_panel'
		],
		[
			'content_security_policy removed',
			(fx) => {
				delete fx.manifest.content_security_policy;
			},
			'content_security_policy'
		],
		[
			"CSP connect-src changed to '*'",
			(fx) => {
				fx.manifest.content_security_policy = {
					extension_pages: CSP.replace("connect-src 'none'", 'connect-src *')
				};
			},
			'content_security_policy'
		],
		[
			'second content_scripts entry',
			(fx) => {
				fx.manifest.content_scripts.push({ ...fx.manifest.content_scripts[0] });
			},
			'content_scripts'
		],
		[
			"content_scripts matches '<all_urls>'",
			(fx) => {
				fx.manifest.content_scripts[0].matches = ['<all_urls>'];
			},
			'matches'
		],
		[
			'content_scripts css missing',
			(fx) => {
				delete fx.manifest.content_scripts[0].css;
			},
			'css'
		],
		[
			'content_scripts run_at changed',
			(fx) => {
				fx.manifest.content_scripts[0].run_at = 'document_start';
			},
			'run_at'
		],
		[
			'name changed',
			(fx) => {
				fx.manifest.name = 'Zillow Official Filter';
			},
			'name'
		],
		[
			'description length 133',
			(fx) => {
				fx.manifest.description = 'x'.repeat(133);
			},
			'description'
		],
		[
			"background with extra key type: 'module'",
			(fx) => {
				fx.manifest.background.type = 'module';
			},
			'background'
		],
		[
			'background with a second key scripts',
			(fx) => {
				fx.manifest.background.scripts = ['background.js'];
			},
			'background'
		],
		[
			'manifest_version 2',
			(fx) => {
				fx.manifest.manifest_version = 2;
			},
			'manifest_version'
		],
		[
			'action.default_popup changed',
			(fx) => {
				(fx.manifest.action as Record<string, unknown>).default_popup = 'other.html';
			},
			'default_popup'
		],
		[
			'icon/128.png missing',
			(fx) => {
				delete fx.files['icon/128.png'];
			},
			'icon/128.png'
		],
		[
			'content script js file missing on disk',
			(fx) => {
				delete fx.files['content-scripts/zillow.js'];
			},
			'content-scripts/zillow.js'
		]
	])('%s is reported', (_name, mutate, needle) => {
		const problems = problemsAfter(mutate);
		expect(problems.length).toBeGreaterThanOrEqual(1);
		expect(problems.join('\n')).toContain(needle);
	});

	test('checkManifest is pure: injected exists() decides file presence', () => {
		expect(checkManifest(goldenManifest(), () => true)).toEqual([]);
		const missing = checkManifest(goldenManifest(), (rel: string) => rel !== 'background.js');
		expect(missing.join('\n')).toContain('background.js');
	});

	test('<all_urls> anywhere in the manifest text is reported', () => {
		const m = goldenManifest();
		(m.action as Record<string, unknown>).default_title = '<all_urls>';
		// Exact message: the default_title check also echoes the planted value, which alone
		// would make a substring assertion pass even with the text scan removed.
		expect(checkManifest(m, () => true)).toContain('manifest.json: contains <all_urls>');
	});
});

describe('assert-extension oracle: planted bundle faults', () => {
	test.each<[string, (fx: Fixture) => void, string]>([
		['fetch(', appendJs('fetch("/x");'), 'fetch'],
		['navigator.sendBeacon(', appendJs('navigator.sendBeacon("/x", "y");'), 'sendBeacon'],
		['new WebSocket(', appendJs('new WebSocket("wss://localhost");'), 'WebSocket'],
		['new XMLHttpRequest', appendJs('new XMLHttpRequest;'), 'XMLHttpRequest'],
		['new EventSource(', appendJs('new EventSource("/x");'), 'EventSource'],
		['importScripts(', appendJs('importScripts("/x.js");'), 'importScripts'],
		['new WebTransport(', appendJs('new WebTransport("/x");'), 'WebTransport'],
		['RTCPeerConnection', appendJs('new RTCPeerConnection();'), 'RTCPeerConnection'],
		['connectNative(', appendJs('chrome.runtime.connectNative("x");'), 'connectNative'],
		[
			'CSS url(https://x.test/a.png)',
			appendCss('.a{background:url(https://x.test/a.png)}'),
			'url('
		],
		['CSS url(//x.test/a.png)', appendCss('.a{background:url(//x.test/a.png)}'), 'url('],
		[
			'JS containing "https://evil.test/collect"',
			appendJs('const c = "https://evil.test/collect";'),
			'https://evil.test/collect'
		],
		[
			'HTML containing a remote script URL',
			(fx) => {
				fx.files['popup.html'] = String(fx.files['popup.html']).replace(
					'</head>',
					'<script src="https://cdn.evil.test/x.js"></script></head>'
				);
			},
			'https://cdn.evil.test/x.js'
		],
		[
			'network token in the background service worker',
			(fx) => {
				fx.files['background.js'] += '\nfetch("https://tranrealestate.github.io/");';
			},
			'background.js'
		]
	])('%s is reported', (_name, mutate, needle) => {
		const problems = problemsAfter(mutate);
		expect(problems.length).toBeGreaterThanOrEqual(1);
		expect(problems.join('\n')).toContain(needle);
	});

	test.each([
		'http://www.w3.org/2000/svg',
		'http://www.w3.org/1999/xlink',
		'http://www.w3.org/1999/xhtml',
		'http://www.w3.org/1998/Math/MathML',
		'https://svelte.dev/e/each_key_duplicate',
		'https://tranrealestate.github.io/legal/privacy/#browser-extension'
	])('allowlisted URL %s is not a problem', (url) => {
		expect(scanBundle([{ path: 'chunks/a.js', text: `const u = "${url}";` }])).toEqual([]);
	});

	test('an allowlist prefix lookalike host is still reported', () => {
		const problems = scanBundle([
			{ path: 'chunks/a.js', text: 'const u = "https://tranrealestate.github.io.evil.test/x";' }
		]);
		expect(problems.join('\n')).toContain('evil.test');
	});
});

describe('assert-extension oracle: output directory and zip', () => {
	test('CLI refuses a -dev output directory', () => {
		withTmp((root) => {
			const dir = writeOutput(root, 'chrome-mv3-dev', golden());
			const r = runCli(dir);
			expect(r.status).toBe(1);
			expect(r.stderr).toContain('refusing dev output');
		});
	});

	test('a missing directory is one problem, not a throw', () => {
		withTmp((root) => {
			const problems = checkOutput(join(root, 'nope', 'chrome-mv3'));
			expect(problems).toHaveLength(1);
		});
	});

	test('a missing manifest.json is reported', () => {
		withTmp((root) => {
			const dir = join(root, 'chrome-mv3');
			mkdirSync(dir);
			expect(checkOutput(dir).join('\n')).toContain('manifest.json');
		});
	});

	test('listZipEntries reads every central-directory name', () => {
		const buf = makeZip([
			['manifest.json', '{}'],
			['popup.html', '<html></html>'],
			['content-scripts/zillow.js', '']
		]);
		expect(listZipEntries(buf)).toEqual([
			'manifest.json',
			'popup.html',
			'content-scripts/zillow.js'
		]);
	});

	test('checkZip passes when manifest.json is a root entry', () => {
		withTmp((root) => {
			const zip = join(root, 'sponsored-listing-filter-0.1.0-chrome.zip');
			writeFileSync(
				zip,
				makeZip([
					['manifest.json', '{}'],
					['popup.html', '']
				])
			);
			expect(checkZip(zip)).toEqual([]);
		});
	});

	test('checkZip fails when the only manifest is nested under chrome-mv3/', () => {
		withTmp((root) => {
			const zip = join(root, 'sponsored-listing-filter-0.1.0-chrome.zip');
			writeFileSync(zip, makeZip([['chrome-mv3/manifest.json', '{}']]));
			expect(checkZip(zip).join('\n')).toContain('manifest.json is not at the zip root');
		});
	});

	test('checkZip reports a file that is not a zip', () => {
		withTmp((root) => {
			const zip = join(root, 'sponsored-listing-filter-0.1.0-chrome.zip');
			writeFileSync(zip, 'not a zip');
			expect(checkZip(zip).length).toBeGreaterThanOrEqual(1);
		});
	});

	test('CLI --zip-dir passes with exactly one good zip', () => {
		withTmp((root) => {
			const dir = writeOutput(root, 'chrome-mv3', golden());
			writeFileSync(
				join(root, 'sponsored-listing-filter-0.1.0-chrome.zip'),
				makeZip([['manifest.json', '{}']])
			);
			const r = runCli(dir, '--zip-dir', root);
			expect(r.stderr).toBe('');
			expect(r.status).toBe(0);
		});
	});

	test('CLI --zip-dir fails when no zip exists', () => {
		withTmp((root) => {
			const dir = writeOutput(root, 'chrome-mv3', golden());
			const r = runCli(dir, '--zip-dir', root);
			expect(r.status).toBe(1);
			expect(r.stderr).toContain('sponsored-listing-filter-');
		});
	});

	test('CLI --zip-dir fails when more than one zip exists', () => {
		withTmp((root) => {
			const dir = writeOutput(root, 'chrome-mv3', golden());
			for (const v of ['0.1.0', '0.1.1']) {
				writeFileSync(
					join(root, `sponsored-listing-filter-${v}-chrome.zip`),
					makeZip([['manifest.json', '{}']])
				);
			}
			const r = runCli(dir, '--zip-dir', root);
			expect(r.status).toBe(1);
			expect(r.stderr).toContain('expected exactly one');
		});
	});

	test('CLI --zip-dir fails when the zip nests the manifest', () => {
		withTmp((root) => {
			const dir = writeOutput(root, 'chrome-mv3', golden());
			writeFileSync(
				join(root, 'sponsored-listing-filter-0.1.0-chrome.zip'),
				makeZip([['chrome-mv3/manifest.json', '{}']])
			);
			const r = runCli(dir, '--zip-dir', root);
			expect(r.status).toBe(1);
			expect(r.stderr).toContain('manifest.json is not at the zip root');
		});
	});

	test('CLI with no directory argument exits 2 with usage', () => {
		const r = runCli();
		expect(r.status).toBe(2);
		expect(r.stderr).toContain('usage');
	});
});
