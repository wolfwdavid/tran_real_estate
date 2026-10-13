// Launch-audit generator (10-22). Turns every Phase 10 gate into docs/LAUNCH-AUDIT.md.
// Usage: node scripts/launch-audit.mjs [--write]
import { pathToFileURL } from 'node:url';

const CHECKLIST_HEADING = `## "Looks Done But Isn't" Checklist`;

/**
 * Command gates the collector runs (or evaluates in-process when `run` is null). PITFALLS
 * evidence rows of type 'command' name one of these ids. Later plans register new gates here.
 * @type {readonly { id: string; command: string; run: string[] | null }[]}
 */
export const COMMAND_GATES = Object.freeze([
	{ id: 'csp', command: 'pnpm csp:assert', run: null },
	{ id: 'seo', command: 'node scripts/assert-seo.mjs <build> --target <t>', run: null },
	{ id: 'budget', command: 'node scripts/assert-budget.mjs apps/web/build', run: null },
	{ id: 'banned', command: 'pnpm banned', run: null },
	{ id: 'deps', command: 'pnpm audit --json --audit-level low', run: null },
	{ id: 'guard', command: 'pnpm guard', run: ['node', 'scripts/guard-real-data.mjs', '--all'] },
	{
		id: 'fixtures:check',
		command: 'pnpm fixtures:check',
		run: ['node', 'scripts/gen-fixtures.mjs', '--check']
	},
	{
		id: 'secrets:canary',
		command: 'pnpm secrets:canary',
		run: ['node', 'scripts/gitleaks-canary.mjs']
	},
	{
		id: 'secrets:scan',
		command: 'pnpm secrets:scan',
		run: ['node', 'scripts/gitleaks.mjs', 'history']
	}
]);

/**
 * Every checklist line (text after `- [ ] `) of the "Looks Done But Isn't" section, verbatim.
 * @param {string} md PITFALLS.md text
 * @returns {string[]}
 */
export function parsePitfallsChecklist(md) {
	const start = md.indexOf(CHECKLIST_HEADING);
	if (start === -1) throw new Error(`PITFALLS.md has no ${CHECKLIST_HEADING} section`);
	const rest = md.slice(start + CHECKLIST_HEADING.length);
	const end = rest.search(/^## /m);
	const section = end === -1 ? rest : rest.slice(0, end);
	return section
		.split(/\r?\n/)
		.filter((l) => l.startsWith('- [ ] '))
		.map((l) => l.slice(6));
}

/**
 * The bold label of a checklist line (`**Label:** ...`), or null.
 * @param {string} line
 */
export function pitfallLabel(line) {
	return /^\*\*(.+?):\*\*/.exec(line)?.[1] ?? null;
}

/**
 * Checklist labels with no evidence entry, and entries with no checklist line.
 * @param {string[]} items parsed checklist lines
 * @param {Record<string, unknown>} map
 */
export function uncoveredPitfalls(items, map) {
	const labels = items.map((l) => pitfallLabel(l) ?? l);
	return {
		missing: labels.filter((l) => !Object.hasOwn(map, l)),
		stale: Object.keys(map).filter((k) => !labels.includes(k))
	};
}

/**
 * Shape errors in an evidence map, one string per problem, each prefixed `<label>:`.
 * @param {Record<string, any>} map
 * @param {readonly { id: string }[]} humanSteps
 * @returns {string[]}
 */
export function evidenceMapErrors(map, humanSteps) {
	const steps = new Set(humanSteps.map((s) => s.id));
	const commands = new Set(COMMAND_GATES.map((g) => g.id));
	/** @type {string[]} */
	const errors = [];
	for (const [label, e] of Object.entries(map)) {
		const err = (msg) => errors.push(`${label}: ${msg}`);
		if (!['auto', 'human', 'na'].includes(e?.kind)) {
			err(`kind must be auto, human or na (got ${JSON.stringify(e?.kind)})`);
			continue;
		}
		if (e.kind === 'auto') {
			if (!Array.isArray(e.evidence) || e.evidence.length === 0) err('auto needs evidence');
			for (const ev of e.evidence ?? []) {
				if (!['e2e', 'unit', 'command'].includes(ev?.type)) err(`bad evidence type ${ev?.type}`);
				else if (typeof ev.match !== 'string' || ev.match.trim() === '') err('empty match');
				else if (ev.type === 'command' && !commands.has(ev.match)) {
					err(`unknown command gate ${ev.match}`);
				}
			}
		} else if (typeof e.reason !== 'string' || e.reason.trim() === '') {
			err(`${e.kind} needs a reason`);
		}
		if (e.kind === 'human' && e.human === undefined) err('human needs a Human UAT step');
		if (e.human !== undefined && !steps.has(e.human)) err(`unknown Human UAT step ${e.human}`);
	}
	return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	console.error('launch-audit: CLI not implemented yet');
	process.exit(2);
}
