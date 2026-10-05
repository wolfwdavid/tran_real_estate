// Structured PII minimization for prompt inputs. Pure: no I/O, no logging.
//
// There is no free-text name detection here (no NER in a static app). Callers declare the
// known PII values a prompt contains; those are replaced with role tokens, and any emails or
// US phone numbers that were not declared are replaced with numbered tokens.

export type PiiKind = 'name' | 'email' | 'phone' | 'address';

/** A value the caller knows is PII, with the role token it should become (no braces). */
export type KnownPii = { value: string; token: string; kind: PiiKind };

/** One replacement that was made. `token` has no braces, e.g. `client_first_name`. */
export type Redaction = { original: string; token: string };

export type RedactionResult = { text: string; redactions: Redaction[] };

/** Matches an inserted `{token}`; later passes never touch these spans. */
const TOKEN_SPAN = /\{[a-z][a-z0-9_]*\}/g;

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu;

// Ten digits in NANP shape. The lookbehind keeps prices ($1,850 / 2,450,000) and decimals out;
// zips, counts, years and 7-digit numbers cannot reach ten digits. The lookahead rejects a
// following digit group ("1234567890,12") but still allows ordinary punctuation after a phone.
const PHONE = /(?<![\d$,.])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d|[,.]\d)/g;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Applies `replace` only to text outside existing `{token}` spans. */
function replaceOutsideTokens(
	text: string,
	pattern: RegExp,
	replace: (match: string) => string
): string {
	let out = '';
	let last = 0;
	for (const span of text.matchAll(TOKEN_SPAN)) {
		out += text.slice(last, span.index).replace(pattern, replace) + span[0];
		last = span.index + span[0].length;
	}
	return out + text.slice(last).replace(pattern, replace);
}

/** Adds first/last-name parts for multi-word names, drops short values, sorts longest first. */
function expandKnown(known: readonly KnownPii[]): { value: string; token: string }[] {
	const entries: { value: string; token: string }[] = [];
	const seen = new Set<string>();
	const add = (value: string, token: string) => {
		const key = value.toLocaleLowerCase();
		if (value.length < 2 || seen.has(key)) return;
		seen.add(key);
		entries.push({ value, token });
	};

	// Declared values win over derived name parts that happen to collide with them.
	for (const k of known) add(k.value.trim(), k.token);
	for (const k of known) {
		if (k.kind !== 'name') continue;
		const parts = k.value.trim().split(/\s+/);
		if (parts.length < 2) continue;
		const prefix = k.token.endsWith('_name') ? k.token.slice(0, -'_name'.length) : k.token;
		add(parts[0]!, `${prefix}_first_name`);
		add(parts[parts.length - 1]!, `${prefix}_last_name`);
	}

	return entries.sort((a, b) => b.value.length - a.value.length);
}

/**
 * Replaces known PII values and undeclared emails/US phones with `{token}` placeholders.
 * Known values match case-insensitively on Unicode letter/number boundaries, longest first.
 */
export function redactPii(text: string, known: readonly KnownPii[]): RedactionResult {
	const redactions: Redaction[] = [];
	const recorded = new Set<string>();
	const record = (original: string, token: string) => {
		const key = `${token}\u0000${original}`;
		if (recorded.has(key)) return;
		recorded.add(key);
		redactions.push({ original, token });
	};

	let out = text;

	for (const { value, token } of expandKnown(known)) {
		const body = escapeRegExp(value).replace(/\s+/g, '\\s+');
		const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu');
		out = replaceOutsideTokens(out, pattern, (match) => {
			record(match, token);
			return `{${token}}`;
		});
	}

	const emailTokens = new Map<string, string>();
	out = replaceOutsideTokens(out, EMAIL, (match) => {
		const key = match.toLowerCase();
		let token = emailTokens.get(key);
		if (token === undefined) {
			token = `email_${emailTokens.size + 1}`;
			emailTokens.set(key, token);
		}
		record(match, token);
		return `{${token}}`;
	});

	const phoneTokens = new Map<string, string>();
	out = replaceOutsideTokens(out, PHONE, (match) => {
		const key = match.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
		let token = phoneTokens.get(key);
		if (token === undefined) {
			token = `phone_${phoneTokens.size + 1}`;
			phoneTokens.set(key, token);
		}
		record(match, token);
		return `{${token}}`;
	});

	return { text: out, redactions };
}
