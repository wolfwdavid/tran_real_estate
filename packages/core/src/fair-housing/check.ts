import { ALLOW_PHRASES } from './allow.js';
import { LEXICON } from './lexicon.js';
import { compilePattern } from './pattern.js';
import { CATEGORY_LABELS, type Finding, type FindingMember, type LexiconEntry } from './types.js';

interface Span {
	start: number;
	end: number;
}

/** Every non-empty match of `source` in `text`, as offsets into the ORIGINAL string. */
function spans(text: string, source: string): Array<Span & { phrase: string }> {
	const out: Array<Span & { phrase: string }> = [];
	for (const m of text.matchAll(compilePattern(source))) {
		if (m[0].length === 0) continue;
		out.push({ start: m.index, end: m.index + m[0].length, phrase: m[0] });
	}
	return out;
}

/**
 * Deterministic Fair Housing check. Runs on the original text (never a
 * lowercased or normalized copy) so offsets are exact for highlighting and
 * `applyAlternative`.
 */
export function checkFairHousing(
	text: string,
	lexicon: readonly LexiconEntry[] = LEXICON,
	allow: readonly string[] = ALLOW_PHRASES
): Finding[] {
	if (text === '' || lexicon.length === 0) return [];

	const allowSpans = allow.flatMap((source) => spans(text, source));
	const seen = new Set<string>();
	const members: FindingMember[] = [];

	for (const entry of lexicon) {
		for (const hit of spans(text, entry.pattern)) {
			if (allowSpans.some((span) => span.start <= hit.start && hit.end <= span.end)) continue;
			const key = `${entry.id}@${hit.start}-${hit.end}`;
			if (seen.has(key)) continue;
			seen.add(key);
			members.push({
				entryId: entry.id,
				checker: 'fair-housing',
				category: entry.category,
				categoryLabel: CATEGORY_LABELS[entry.category],
				scope: entry.scope,
				severity: entry.severity,
				explanation: entry.explanation,
				alternative: entry.alternative,
				source: entry.source,
				phrase: hit.phrase,
				start: hit.start,
				end: hit.end
			});
		}
	}

	return mergeFindings(members, text);
}

/**
 * Groups overlapping members (from any checker) into findings: one group per
 * overlapping run, severity 'block' if any member blocks. Members are ordered
 * by start, then longer first, then block before warn, then input order.
 */
export function mergeFindings(members: readonly FindingMember[], text: string): Finding[] {
	const sorted = members
		.map((member, index) => ({ member, index }))
		.sort(
			(a, b) =>
				a.member.start - b.member.start ||
				b.member.end - a.member.end ||
				severityRank(a.member) - severityRank(b.member) ||
				a.index - b.index
		)
		.map(({ member }) => member);

	const findings: Finding[] = [];
	let group: FindingMember[] = [];
	let start = 0;
	let end = 0;

	const flush = (): void => {
		if (group.length === 0) return;
		findings.push({
			id: `${start}-${end}`,
			start,
			end,
			severity: group.some((m) => m.severity === 'block') ? 'block' : 'warn',
			phrase: text.slice(start, end),
			members: group
		});
	};

	for (const member of sorted) {
		if (group.length > 0 && member.start < end) {
			group.push(member);
			end = Math.max(end, member.end);
			continue;
		}
		flush();
		group = [member];
		start = member.start;
		end = member.end;
	}
	flush();
	return findings;
}

function severityRank(member: FindingMember): number {
	return member.severity === 'block' ? 0 : 1;
}
