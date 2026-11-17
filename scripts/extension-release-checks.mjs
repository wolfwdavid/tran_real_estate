// Release gates for the browser extension (EXT-05, EXT-06, EXT-08). Each check is a pure,
// importable function returning string[] problems ([] means pass); the CLI below is what the
// release workflow calls. Dependency-free: node builtins plus two relative imports.
//
// usage: node scripts/extension-release-checks.mjs <version|ancestor|probe|notes|summary> [flags]
// exit codes: 0 pass, 1 problems, 2 usage
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveSiteUrl } from '../apps/web/src/lib/site-config.js';
import { ZIP_NAME, listZipEntries } from './assert-extension.mjs';

const TAG = /^ext-v\d+\.\d+\.\d+$/;

/**
 * Tag, package.json, BUILT manifest and zip name must carry one x.y.z. An empty tag (the
 * workflow_dispatch dry-run has a branch ref) skips only the two tag checks.
 * @param {{ tag?: string, packageVersion: string, manifestVersion: string, zipNames: string[] }} a
 * @returns {string[]}
 */
export function checkVersions({ tag, packageVersion, manifestVersion, zipNames }) {
	const errors = [];
	if (tag) {
		if (!TAG.test(tag)) errors.push(`tag ${JSON.stringify(tag)} does not match ext-vX.Y.Z`);
		else if (tag !== `ext-v${packageVersion}`) {
			errors.push(`tag ${tag} does not match package.json version ${packageVersion}`);
		}
	}
	if (manifestVersion !== packageVersion) {
		errors.push(
			`built manifest version ${manifestVersion} does not match package.json version ${packageVersion}`
		);
	}
	const suffix = `-${packageVersion}-chrome.zip`;
	if (zipNames.length !== 1 || !zipNames[0].endsWith(suffix)) {
		errors.push(
			`expected exactly one zip ending in ${suffix}, found ${zipNames.length ? zipNames.join(', ') : 'none'}`
		);
	}
	return errors;
}

/**
 * HEAD must be an ancestor of ref (default origin/main); an unresolvable ref fails closed.
 * git is spawned with an argv array and no shell.
 * @param {{ ref?: string, cwd?: string }} [opts]
 * @returns {string[]}
 */
export function checkAncestor({ ref = 'origin/main', cwd = process.cwd() } = {}) {
	const git = (...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
	const verify = git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
	if (verify.status === 1 && !verify.stderr.trim()) {
		return [`${ref} does not resolve; checkout needs fetch-depth: 0`];
	}
	if (verify.status !== 0) return [`git rev-parse ${ref} failed: ${verify.stderr.trim()}`];
	const r = git('merge-base', '--is-ancestor', 'HEAD', ref);
	if (r.status === 0) return [];
	if (r.status === 1) {
		const sha = git('rev-parse', 'HEAD').stdout.trim();
		return [`HEAD ${sha} is not an ancestor of ${ref}`];
	}
	return [`git merge-base failed: ${(r.stderr || r.error?.message || '').trim()}`];
}

/**
 * The live privacy page must answer 200 and carry the extension anchor.
 * @param {{ siteUrl: string, fetchImpl?: typeof fetch }} a
 * @returns {Promise<string[]>}
 */
export async function probePrivacyUrl({ siteUrl, fetchImpl = fetch }) {
	const url = `${siteUrl}/legal/privacy/`;
	try {
		// shortcut: single attempt, no retry; a Pages blip fails the release job and the owner re-runs (releases are rare)
		const res = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
		if (res.status !== 200) return [`${url} answered ${res.status}, expected 200`];
		const body = await res.text();
		if (!body.includes('id="browser-extension"')) {
			return [`${url} has no id="browser-extension" anchor`];
		}
		return [];
	} catch (e) {
		return [`${url} could not be fetched: ${e instanceof Error ? e.message : String(e)}`];
	}
}

/**
 * Body of the `## [version] - YYYY-MM-DD` section without link-reference lines. Throws on a
 * missing heading, a bad date or an empty body.
 * @param {string} text
 * @param {string} version
 * @returns {string}
 */
export function extractNotes(text, version) {
	const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const m = new RegExp(`^## \\[${esc}\\] - (\\S+)[ \\t]*$`, 'm').exec(text);
	if (!m) throw new Error(`CHANGELOG has no "## [${version}] - YYYY-MM-DD" heading`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(m[1])) {
		throw new Error(`CHANGELOG ${version} date ${JSON.stringify(m[1])} is not YYYY-MM-DD`);
	}
	const rest = text.slice(m.index + m[0].length);
	const next = rest.search(/^## /m);
	const body = (next === -1 ? rest : rest.slice(0, next))
		.split('\n')
		.filter((l) => !/^\[[^\]]+\]: \S+/.test(l))
		.join('\n')
		.trim();
	if (!body) throw new Error(`CHANGELOG ${version} section is empty`);
	return body;
}

/**
 * Markdown for the job summary.
 * @param {{ zipPath: string, sumsPath: string }} a
 * @returns {string}
 */
export function summarize({ zipPath, sumsPath }) {
	const entries = listZipEntries(readFileSync(zipPath)).length;
	return [
		`### ${basename(zipPath)}`,
		'',
		`- Size: ${statSync(zipPath).size} bytes`,
		`- Entries: ${entries}`,
		'',
		'```',
		readFileSync(sumsPath, 'utf8').trim(),
		'```',
		''
	].join('\n');
}

function fail(problems) {
	console.error(`Release check failed (${problems.length}):\n- ` + problems.join('\n- '));
	process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [cmd, ...rest] = process.argv.slice(2);
	const flag = (name, dflt) => {
		const i = rest.indexOf(`--${name}`);
		return i === -1 ? dflt : rest[i + 1];
	};
	const zipDir = flag('zip-dir', 'apps/extension/.output');
	const pkgPath = flag('package', 'apps/extension/package.json');
	const zips = () => {
		try {
			return readdirSync(zipDir).filter((f) => ZIP_NAME.test(f));
		} catch {
			return [];
		}
	};

	if (cmd === 'version') {
		const packageVersion = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
		const manifestVersion = JSON.parse(
			readFileSync(flag('manifest', 'apps/extension/.output/chrome-mv3/manifest.json'), 'utf8')
		).version;
		const problems = checkVersions({
			tag: process.env.RELEASE_TAG ?? '',
			packageVersion,
			manifestVersion,
			zipNames: zips()
		});
		if (problems.length) fail(problems);
		console.log(`versions agree: ${packageVersion}`);
	} else if (cmd === 'ancestor') {
		const problems = checkAncestor({});
		if (problems.length) fail(problems);
		console.log('HEAD is an ancestor of origin/main');
	} else if (cmd === 'probe') {
		const siteUrl = resolveSiteUrl(process.env);
		const problems = await probePrivacyUrl({ siteUrl });
		if (problems.length) fail(problems);
		console.log(`probed ${siteUrl}/legal/privacy/`);
	} else if (cmd === 'notes') {
		const out = flag('out');
		if (!out) {
			console.error('usage: node scripts/extension-release-checks.mjs notes --out <file>');
			process.exit(2);
		}
		try {
			const version = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
			const text = readFileSync(flag('changelog', 'apps/extension/CHANGELOG.md'), 'utf8');
			writeFileSync(out, extractNotes(text, version) + '\n');
		} catch (e) {
			console.error(e instanceof Error ? e.message : String(e));
			process.exit(1);
		}
	} else if (cmd === 'summary') {
		const z = zips();
		if (z.length !== 1) fail([`expected exactly one release zip in ${zipDir}, found ${z.length}`]);
		console.log(
			summarize({ zipPath: join(zipDir, z[0]), sumsPath: join(zipDir, 'SHA256SUMS.txt') })
		);
	} else {
		console.error(
			'usage: node scripts/extension-release-checks.mjs <version|ancestor|probe|notes|summary>'
		);
		process.exit(2);
	}
}
