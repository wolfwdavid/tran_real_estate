// Independent zero-network / least-privilege oracle over a PRODUCTION WXT extension output
// (EXT-03 build-output layer; the source layer is the eslint.config.js extension block and the
// runtime layer is the popup CSP below).
//
// The manifest strings and EXPECTED_CSP are deliberate literal duplicates of
// apps/extension/src/lib/copy.ts and apps/extension/wxt.config.ts POPUP_CSP (same precedent as
// assert-csp.mjs's CONNECT list): changing either must produce a reviewed two-file diff in one
// commit, never a silent pass. Dependency-free on purpose: node builtins plus a relative import of
// the web app's plain-JS origin validator, so the allowlisted site origin is the one the build used.
//
// usage: node scripts/assert-extension.mjs <outDir> [--zip-dir <dir>]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveSiteOrigin } from '../apps/web/src/lib/site-config.js';

export const EXPECTED_NAME = 'Sponsored Listing Filter — for Zillow';
export const EXPECTED_SHORT_NAME = 'Sponsored Filter';
export const EXPECTED_DESCRIPTION =
	'Dims sponsored listing cards in Zillow search results. Show any card with one click. Collects nothing, sends nothing.';
export const EXPECTED_ACTION_TITLE = 'Sponsored Listing Filter';
export const ZILLOW_MATCH = '*://*.zillow.com/*';
export const EXPECTED_PERMISSIONS = ['storage'];
export const EXPECTED_HOSTS = [ZILLOW_MATCH];
export const EXPECTED_CSP =
	"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export const EXPECTED_BACKGROUND = { service_worker: 'background.js' };
export const MAX_DESCRIPTION = 132;

// Named surfaces that widen what the extension can reach or expose; reported by name.
export const FORBIDDEN_KEYS = [
	'web_accessible_resources',
	'optional_permissions',
	'optional_host_permissions',
	'externally_connectable',
	'commands',
	'declarative_net_request',
	'chrome_url_overrides',
	'devtools_page',
	'sandbox',
	'oauth2',
	'key',
	'update_url'
];

// Default-deny: every other top-level key is an unreviewed surface (side_panel, options_page, ...).
export const ALLOWED_KEYS = [
	'manifest_version',
	'name',
	'short_name',
	'description',
	'version',
	'version_name',
	'icons',
	'permissions',
	'host_permissions',
	'action',
	'background',
	'content_scripts',
	'content_security_policy'
];

/** @type {Array<[string, RegExp]>} */
export const NETWORK_TOKENS = [
	['fetch(', /\bfetch\s*\(/],
	['XMLHttpRequest', /XMLHttpRequest/],
	['WebSocket', /\bWebSocket\b/],
	['EventSource', /\bEventSource\b/],
	['sendBeacon', /sendBeacon/],
	['importScripts', /importScripts/],
	['WebTransport', /\bWebTransport\b/],
	['RTCPeerConnection', /RTCPeerConnection/],
	['connectNative/sendNativeMessage', /connectNative|sendNativeMessage/]
];

export const CSS_REMOTE_URL = /url\(\s*['"]?(?:https?:)?\/\//i;
const URL_PATTERN = /https?:\/\/[^\s"'`)<>\\]+/g;

// Prefix match. Namespace URIs and Svelte's error-doc links are inert strings; the privacy link
// is the one navigation target (opened in a tab, never fetched).
const STATIC_URL_ALLOWLIST = [
	'http://www.w3.org/2000/svg',
	'http://www.w3.org/1999/xlink',
	'http://www.w3.org/1999/xhtml',
	'http://www.w3.org/1998/Math/MathML',
	'https://svelte.dev/e/',
	// Exact URLs inside the error text WXT's `wxt/browser` shim throws when no extension API
	// exists ("If thrown during a build, see ..."). Shown to developers, never fetched.
	'https://github.com/wxt-dev/wxt/issues/371',
	'https://wxt.dev/guide/go-further/testing.html'
];

/**
 * The privacy link's origin follows PUBLIC_SITE_URL (LIVE-08), like the build that produced the
 * bundle. The trailing slash keeps a lookalike host (origin + ".evil.test") off the list.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function urlAllowlist(env = process.env) {
	return [...STATIC_URL_ALLOWLIST, `${resolveSiteOrigin(env)}/`];
}

export const URL_ALLOWLIST = urlAllowlist();

export const ZIP_NAME = /^sponsored-listing-filter-\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?-chrome\.zip$/;

const SCANNED = /\.(?:m?js|html|css)$/;

const json = (v) => JSON.stringify(v);
const sameJson = (a, b) => json(a) === json(b);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const walk = (d) =>
	readdirSync(d).flatMap((f) =>
		statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]
	);

/**
 * Returns [] when the manifest is exactly the least-privilege production shape.
 * @param {any} m parsed manifest.json
 * @param {(rel: string) => boolean} exists whether a manifest-relative file is in the output
 * @returns {string[]}
 */
export function checkManifest(m, exists) {
	if (!isObj(m)) return ['manifest.json: not a JSON object'];
	const errors = [];
	const err = (msg) => errors.push(`manifest.json: ${msg}`);

	if (m.manifest_version !== 3) err(`manifest_version is ${json(m.manifest_version)}, expected 3`);
	if (m.name !== EXPECTED_NAME) err(`name is ${json(m.name)}, expected ${json(EXPECTED_NAME)}`);
	if (m.short_name !== EXPECTED_SHORT_NAME) {
		err(`short_name is ${json(m.short_name)}, expected ${json(EXPECTED_SHORT_NAME)}`);
	}
	if (m.description !== EXPECTED_DESCRIPTION) err('description differs from COPY.description');
	if (typeof m.description !== 'string' || m.description.length > MAX_DESCRIPTION) {
		err(`description is ${m.description?.length} chars (max ${MAX_DESCRIPTION})`);
	}
	if (typeof m.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(m.version)) {
		err(`version ${json(m.version)} is not a Chrome version string`);
	}
	if (!sameJson(m.permissions, EXPECTED_PERMISSIONS)) {
		err(`permissions is ${json(m.permissions)}, expected ${json(EXPECTED_PERMISSIONS)}`);
	}
	if (!sameJson(m.host_permissions, EXPECTED_HOSTS)) {
		err(`host_permissions is ${json(m.host_permissions)}, expected ${json(EXPECTED_HOSTS)}`);
	}
	for (const k of Object.keys(m)) {
		if (FORBIDDEN_KEYS.includes(k)) err(`forbidden key ${k}`);
		else if (!ALLOWED_KEYS.includes(k)) err(`unexpected top-level key ${k} (not reviewed)`);
	}
	if (json(m).includes('<all_urls>')) err('contains <all_urls>');

	const cs = m.content_scripts;
	if (!Array.isArray(cs) || cs.length !== 1) {
		err(`content_scripts must have exactly one entry, found ${Array.isArray(cs) ? cs.length : 0}`);
	}
	const entry = Array.isArray(cs) && isObj(cs[0]) ? cs[0] : {};
	if (!sameJson(entry.matches, [ZILLOW_MATCH])) {
		err(`content_scripts[0].matches is ${json(entry.matches)}, expected ${json([ZILLOW_MATCH])}`);
	}
	for (const k of ['js', 'css']) {
		if (!Array.isArray(entry[k]) || entry[k].length === 0) {
			err(`content_scripts[0].${k} must be a non-empty array`);
		}
	}
	if (entry.run_at !== 'document_idle') {
		err(`content_scripts[0].run_at is ${json(entry.run_at)}, expected "document_idle"`);
	}
	if (!sameJson(m.background, EXPECTED_BACKGROUND)) {
		err(`background is ${json(m.background)}, expected ${json(EXPECTED_BACKGROUND)}`);
	}
	const action = isObj(m.action) ? m.action : {};
	if (action.default_popup !== 'popup.html') {
		err(`action.default_popup is ${json(action.default_popup)}, expected "popup.html"`);
	}
	if (action.default_title !== EXPECTED_ACTION_TITLE) {
		err(`action.default_title is ${json(action.default_title)}`);
	}
	if (m.content_security_policy?.extension_pages !== EXPECTED_CSP) {
		err(
			`content_security_policy.extension_pages is ${json(m.content_security_policy?.extension_pages)}, expected the popup CSP (connect-src 'none')`
		);
	}

	const refs = new Map();
	const ref = (rel, where) => typeof rel === 'string' && !refs.has(rel) && refs.set(rel, where);
	if (isObj(m.icons)) for (const v of Object.values(m.icons)) ref(v, 'icons');
	if (isObj(action.default_icon)) {
		for (const v of Object.values(action.default_icon)) ref(v, 'action.default_icon');
	}
	ref(action.default_popup, 'action.default_popup');
	for (const k of ['js', 'css']) {
		if (Array.isArray(entry[k])) for (const v of entry[k]) ref(v, `content_scripts[0].${k}`);
	}
	ref(m.background?.service_worker, 'background.service_worker');
	for (const [rel, where] of refs) {
		if (!exists(rel)) err(`missing file ${rel} (${where})`);
	}
	return errors;
}

/**
 * Returns [] when no built JS/HTML/CSS carries a network primitive or a non-allowlisted URL.
 * @param {Array<{ path: string, text: string }>} files output-relative paths with their text
 * @param {readonly string[]} [allowlist] URL prefixes allowed in the bundle
 * @returns {string[]}
 */
export function scanBundle(files, allowlist = URL_ALLOWLIST) {
	const errors = [];
	for (const { path, text } of files) {
		const isCss = path.endsWith('.css');
		if (!isCss) {
			for (const [label, re] of NETWORK_TOKENS) {
				if (re.test(text)) errors.push(`${path}: network token ${label}`);
			}
		} else if (CSS_REMOTE_URL.test(text)) {
			errors.push(`${path}: remote url( in CSS`);
		}
		for (const [url] of text.matchAll(URL_PATTERN)) {
			if (!allowlist.some((p) => url.startsWith(p))) {
				errors.push(`${path}: URL not on allowlist: ${url}`);
			}
		}
	}
	return errors;
}

/** Number of files scanBundle would read under dir (for the CLI summary). */
export const countScanned = (dir) =>
	existsSync(dir) ? walk(dir).filter((f) => SCANNED.test(f)).length : 0;

/**
 * Returns [] when dir is a production output whose manifest and bundle pass.
 * @param {string} dir
 * @param {readonly string[]} [allowlist] URL prefixes allowed in the bundle
 * @returns {string[]}
 */
export function checkOutput(dir, allowlist = URL_ALLOWLIST) {
	if (/-dev$/.test(basename(dir))) return [`refusing dev output: ${dir}`];
	if (!existsSync(dir) || !statSync(dir).isDirectory()) return [`missing output directory ${dir}`];
	const manifestFile = join(dir, 'manifest.json');
	if (!existsSync(manifestFile)) return [`missing manifest.json in ${dir}`];
	let m;
	try {
		m = JSON.parse(readFileSync(manifestFile, 'utf8'));
	} catch (e) {
		return [`manifest.json: invalid JSON (${e.message})`];
	}
	const exists = (rel) => existsSync(join(dir, rel)) && statSync(join(dir, rel)).isFile();
	const files = walk(dir)
		.filter((f) => SCANNED.test(f))
		.map((f) => ({ path: relative(dir, f).split(sep).join('/'), text: readFileSync(f, 'utf8') }));
	return [...checkManifest(m, exists), ...scanBundle(files, allowlist)];
}

/**
 * Central-directory file names of a zip, in order. Throws on a buffer with no EOCD record.
 * @param {Buffer} buf
 * @returns {string[]}
 */
export function listZipEntries(buf) {
	let eocd = -1;
	for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
		if (buf.readUInt32LE(i) === 0x06054b50) {
			eocd = i;
			break;
		}
	}
	if (eocd === -1) throw new Error('no end-of-central-directory record');
	const count = buf.readUInt16LE(eocd + 10);
	let off = buf.readUInt32LE(eocd + 16);
	const names = [];
	for (let n = 0; n < count; n++) {
		if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) {
			throw new Error(`bad central directory record at ${off}`);
		}
		const nameLen = buf.readUInt16LE(off + 28);
		const extraLen = buf.readUInt16LE(off + 30);
		const commentLen = buf.readUInt16LE(off + 32);
		names.push(buf.toString('utf8', off + 46, off + 46 + nameLen));
		off += 46 + nameLen + extraLen + commentLen;
	}
	return names;
}

/**
 * Returns [] when the zip has manifest.json as a root entry (the store rejects a nested one).
 * @param {string} path
 * @returns {string[]}
 */
export function checkZip(path) {
	let entries;
	try {
		entries = listZipEntries(readFileSync(path));
	} catch (e) {
		return [`${basename(path)}: not a readable zip (${e.message})`];
	}
	if (!entries.includes('manifest.json')) {
		return [`${basename(path)}: manifest.json is not at the zip root`];
	}
	return [];
}

/** Returns [] when zipDir holds exactly one release zip and that zip passes checkZip. */
export function checkZipDir(zipDir) {
	if (!existsSync(zipDir)) return [`missing zip directory ${zipDir}`];
	const zips = readdirSync(zipDir).filter((f) => ZIP_NAME.test(f));
	if (zips.length !== 1) {
		return [
			`expected exactly one sponsored-listing-filter-<semver>-chrome.zip in ${zipDir}, found ${zips.length}${zips.length ? ` (${zips.join(', ')})` : ''}`
		];
	}
	return checkZip(join(zipDir, zips[0]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const args = process.argv.slice(2);
	const z = args.indexOf('--zip-dir');
	const zipDir = z === -1 ? undefined : args[z + 1];
	const dir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--zip-dir');
	if (!dir || (z !== -1 && !zipDir)) {
		console.error('usage: node scripts/assert-extension.mjs <outDir> [--zip-dir <dir>]');
		process.exit(2);
	}
	const errors = [...checkOutput(dir), ...(zipDir ? checkZipDir(zipDir) : [])];
	if (errors.length) {
		console.error(`Extension oracle failed (${errors.length}):\n- ` + errors.join('\n- '));
		process.exit(1);
	}
	console.log(
		`Extension oracle passed (${countScanned(dir)} files scanned in ${dir}${zipDir ? ', zip root verified' : ''})`
	);
}
