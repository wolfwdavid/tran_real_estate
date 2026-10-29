// Commit-message hygiene (LIVE-01 recurrence guard). The history was rewritten once in Phase 12
// to remove tool attribution trailers; this check keeps them out. Product content that names
// model providers (adapters, model ids, dialogs) is allowed; attribution lines are not.
//   node scripts/commit-hygiene.mjs --message-file <path>   commit-msg hook (simple-git-hooks)
//   node scripts/commit-hygiene.mjs --history [<rev>...]   every commit reachable from <rev> (default --all)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ATTRIBUTION_PATTERNS = Object.freeze([
	/^co-authored-by:[^\n]*(?:anthropic|claude)/im,
	/noreply@anthropic\.com/i,
	/generated with \[?claude/i,
	/claude code/i,
	/\u{1F916}/u
]);

/** git's verbose-commit scissors line: everything below it is diff context, never the message. */
const SCISSORS = /^# -+ >8 -+$/m;

/** @param {string} message @returns {string[]} the source of every pattern the message matches */
export function attributionOffences(message) {
	return ATTRIBUTION_PATTERNS.filter((re) => re.test(message)).map((re) => re.source);
}

/**
 * The message git will record from a COMMIT_EDITMSG-style file: text below the scissors line is
 * dropped, then every `#` comment line.
 * @param {string} raw
 */
export function stripCommentLines(raw) {
	const cut = raw.search(SCISSORS);
	const kept = cut === -1 ? raw : raw.slice(0, cut);
	return kept
		.split(/\r?\n/)
		.filter((line) => !/^#/.test(line))
		.join('\n');
}

/** @param {string} raw output of `git log --format=%H%x00%B%x00` @returns {{sha: string, message: string}[]} */
export function parseLog(raw) {
	const parts = raw.split('\0');
	/** @type {{sha: string, message: string}[]} */
	const commits = [];
	for (let i = 0; i + 1 < parts.length; i += 2) {
		const sha = parts[i].trim();
		if (!sha) continue;
		commits.push({ sha, message: parts[i + 1] });
	}
	return commits;
}

const USAGE = 'Usage: node scripts/commit-hygiene.mjs --message-file <path> | --history [<rev>...]';

/** @param {string} file */
function checkMessageFile(file) {
	const offences = attributionOffences(stripCommentLines(readFileSync(file, 'utf8')));
	if (offences.length === 0) return 0;
	console.error(
		`commit-hygiene: commit message carries assistant attribution (${offences.join(', ')}). Remove it; commit messages never mention AI assistants (CLAUDE.md).`
	);
	return 1;
}

/** @param {string[]} revs */
function checkHistory(revs) {
	const r = spawnSync(
		'git',
		['log', '--format=%H%x00%B%x00', ...(revs.length ? revs : ['--all'])],
		{
			encoding: 'utf8',
			maxBuffer: 256 * 1024 * 1024
		}
	);
	if (r.error || r.status !== 0) {
		console.error(r.stderr || String(r.error));
		return 2;
	}
	const commits = parseLog(r.stdout);
	const bad = commits.filter((c) => attributionOffences(c.message).length > 0);
	for (const c of bad) console.log(`${c.sha.slice(0, 7)} ${c.message.split('\n')[0]}`);
	console.log(
		`commit-hygiene: ${commits.length} commits scanned, ${bad.length} with assistant attribution`
	);
	return bad.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [flag, ...rest] = process.argv.slice(2);
	if (flag === '--message-file' && rest[0]) {
		process.exit(checkMessageFile(rest[0]));
	} else if (flag === '--history') {
		process.exit(checkHistory(rest));
	} else {
		console.error(USAGE);
		process.exit(2);
	}
}
