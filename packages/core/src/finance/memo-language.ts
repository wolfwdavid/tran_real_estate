// Advice-language check for deal memos (INV-06, RESEARCH Pitfall 9). Tran gives no investment
// advice, so a memo must never promise an outcome or tell the reader what to buy.
//
// - block: promissory claims (an outcome stated as certain).
// - warn: judgements or advice ("a good deal", "we recommend"), which the user can rephrase.
//
// The phrase list is a superset of the investor copy gate (scripts/lib/banned-terms-rules.mjs:
// INVESTOR_BANNED plus the promissory entries of BANNED), so the copy gate and the memo check never
// disagree. Keep the two in step when either changes. This file lives in core, which the copy gate
// does not scan, so the lexicon's own words cannot fail it.

export interface AdviceFinding {
	start: number;
	end: number;
	/** text.slice(start, end) */
	text: string;
	severity: 'block' | 'warn';
	category: 'advice-language';
	/** The lexicon entry that matched. */
	phrase: string;
}

/** Phrase words joined by any whitespace, so a phrase wrapped across lines still matches. */
const words = (s: string): string => s.trim().split(/\s+/).join('\\s+');

const LEXICON: ReadonlyArray<readonly [string, 'block' | 'warn', RegExp]> = [
	['guaranteed', 'block', /\bguarantee(?:s|d)?\b|\bguarant(?:y|ies)\b/giu],
	['risk-free', 'block', /\brisk[-\s]?free\b/giu],
	['will appreciate', 'block', new RegExp(`\\b${words('will appreciate')}\\b`, 'giu')],
	["can't lose", 'block', /\b(?:can[’']?t|cannot|can\s+not)\s+lose\b/giu],
	['great investment', 'warn', new RegExp(`\\b${words('great investment')}s?\\b`, 'giu')],
	['good investment', 'warn', new RegExp(`\\b${words('good investment')}s?\\b`, 'giu')],
	['best investment', 'warn', new RegExp(`\\b${words('best investment')}s?\\b`, 'giu')],
	['great deal', 'warn', new RegExp(`\\b${words('great deal')}s?\\b`, 'giu')],
	['good deal', 'warn', new RegExp(`\\b${words('good deal')}s?\\b`, 'giu')],
	['bad deal', 'warn', new RegExp(`\\b${words('bad deal')}s?\\b`, 'giu')],
	['we recommend', 'warn', new RegExp(`\\b${words('we recommend')}\\b`, 'giu')],
	['passive income', 'warn', new RegExp(`\\b${words('passive income')}\\b`, 'giu')],
	['no-brainer', 'warn', /\bno[-\s]?brainers?\b/giu],
	['cash cow', 'warn', new RegExp(`\\b${words('cash cow')}s?\\b`, 'giu')],
	['you should', 'warn', new RegExp(`\\b${words('you should')}\\b`, 'giu')]
];

export function checkAdviceLanguage(text: string): AdviceFinding[] {
	const out: AdviceFinding[] = [];
	if (!text) return out;
	for (const [phrase, severity, re] of LEXICON) {
		for (const m of text.matchAll(re)) {
			out.push({
				start: m.index,
				end: m.index + m[0].length,
				text: m[0],
				severity,
				category: 'advice-language',
				phrase
			});
		}
	}
	return out.sort((a, b) => a.start - b.start || b.end - a.end);
}
