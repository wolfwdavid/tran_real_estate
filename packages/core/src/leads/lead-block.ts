// TRAN-LEAD v1: the structured block the inquiry page sends inside the Web3Forms notification
// email, and the tolerant parser behind paste import (AGT-02, AGT-03).
//
//   TRAN-LEAD v1
//   name: Jordan Example
//   email: jordan@example.com
//   phone: (555) 555-0142
//   property: 12 Sample Lane, Harlow Springs
//   consent: yes
//   submitted: 2026-10-04T15:04:05Z
//   message: Could we tour Saturday?
//   Second line of the message.
//   END TRAN-LEAD
//
// Email clients mangle the block: newlines collapse to spaces, forwards add "> " quoting, CRLF,
// NBSP and zero-width characters appear, long lines wrap. So the parser never relies on line
// structure. It searches the keys forward-only in the fixed order above and stops at an explicit
// END TRAN-LEAD terminator. The builder makes that search unambiguous by neutralizing anything in
// a value that could read as a key or a block marker.
//
// Security: anyone holding an agent's public Web3Forms key can post arbitrary blocks, so every
// parsed value is untrusted text. Values are cleaned of control/bidi characters here and must
// only ever be rendered as text, never interpreted as HTML, URLs or commands.
import * as z from 'zod/mini';

import { MAX_EMAIL, MAX_NAME, MAX_PROPERTY } from '../agent/schemas.js';
import { cleanText, normalizeText, normEmail } from './normalize.js';

export const LEAD_KEYS = [
	'name',
	'email',
	'phone',
	'property',
	'consent',
	'submitted',
	'message'
] as const;
export type LeadKey = (typeof LEAD_KEYS)[number];

export const LEAD_BLOCK_HEADER = 'TRAN-LEAD v1';
export const LEAD_BLOCK_END = 'END TRAN-LEAD';
export const MAX_LEAD_MESSAGE = 5000;

export interface LeadBlockFields {
	name: string;
	email: string;
	phone?: string;
	property?: string;
	consent: boolean;
	submitted: string;
	message: string;
}

export interface ParsedLead {
	name: string;
	email: string;
	phone: string;
	property: string;
	consent: boolean;
	submitted: string;
	message: string;
}

export type ParsedLeadBlock =
	| { ok: true; lead: ParsedLead }
	| { ok: false; error: 'newer-version'; version: number }
	| { ok: false; error: 'invalid'; detail: string };

const KEY_ALTERNATION = LEAD_KEYS.join('|');
/** A key at the start of a value or after whitespace, exactly as the parser would find it. */
const FORGED_KEY = new RegExp(String.raw`(^|\s)(${KEY_ALTERNATION}):`, 'gi');
/** Every block marker contains this; without the hyphen neither header nor terminator matches. */
const MARKER = /(TRAN)-(LEAD)/gi;
/**
 * Two spaces before a message line that starts with ">". Quote stripping (/^(>\s?)+/) removes at
 * most one space after the last ">", so the visitor's own ">" survives "> ", ">", "> > " and ">>"
 * forwarding alike. One space would be eaten by bare ">" quoting.
 */
const QUOTE_GUARD = '  ';

const HEADER = /TRAN-LEAD\s+v(\d+)/gi;
const TERMINATOR = /END\s+TRAN-LEAD/i;
const END_BEFORE = /END\s+$/i;
const KEY_PATTERNS = LEAD_KEYS.map(
	(key) => [key, new RegExp(String.raw`(?:^|\s)${key}:\s*`, 'i')] as const
);
/** A line break inside a single-line value comes from soft wrapping; it stood for a space. */
const WRAP = /[^\S\n]*\n\s*/g;

const leadLimits = z.object({
	name: z.string().check(z.minLength(1), z.maxLength(MAX_NAME)),
	email: z.string().check(z.maxLength(MAX_EMAIL)),
	property: z.string().check(z.maxLength(MAX_PROPERTY)),
	message: z.string().check(z.maxLength(MAX_LEAD_MESSAGE))
});

/**
 * The exact text buildLeadBlock writes for one value.
 * - Single-line fields: CR/LF become one space, then cleanText (control/bidi/zero-width stripped,
 *   NFKC, trimmed), then forged keys become "key :" and TRAN-LEAD becomes "TRAN LEAD". NFKC runs
 *   first so a full-width colon cannot turn into a key afterwards.
 * - message: line endings unified, cleanText (keeps newlines and tabs), markers neutralized, and
 *   lines starting with ">" get a guard indent. Key-like text stays visible: the message is the
 *   last key, so the forward-only search never reads it as a field.
 */
export function canonicalLeadField(key: LeadKey, value: string): string {
	if (key === 'message') {
		return cleanText(value.replace(/\r\n?/g, '\n'))
			.replace(MARKER, '$1 $2')
			.split('\n')
			.map((line) => (line.startsWith('>') ? QUOTE_GUARD + line : line))
			.join('\n');
	}
	return cleanText(value.replace(/[\r\n]+/g, ' '))
		.replace(MARKER, '$1 $2')
		.replace(FORGED_KEY, '$1$2 :');
}

/** Renders the TRAN-LEAD v1 block (lines joined by "\n"); every key is always present. */
export function buildLeadBlock(f: LeadBlockFields): string {
	const line = (key: LeadKey, value: string) => `${key}: ${canonicalLeadField(key, value)}`;
	return [
		LEAD_BLOCK_HEADER,
		line('name', f.name),
		line('email', f.email),
		line('phone', f.phone ?? ''),
		line('property', f.property ?? ''),
		line('consent', f.consent ? 'yes' : 'no'),
		line('submitted', f.submitted),
		line('message', f.message),
		LEAD_BLOCK_END
	].join('\n');
}

/**
 * Finds every TRAN-LEAD block in pasted text and parses each one, in order. Blocks from a newer
 * format version are reported as 'newer-version' instead of being misread.
 */
export function parseLeadBlocks(text: string): ParsedLeadBlock[] {
	const t = normalizeText(text);
	const headers = [...t.matchAll(HEADER)].filter(
		(m) => !END_BEFORE.test(t.slice(Math.max(0, m.index - 64), m.index))
	);
	return headers.map((m, i) => {
		const start = m.index + m[0].length;
		const limit = headers[i + 1]?.index ?? t.length;
		const end = TERMINATOR.exec(t.slice(start, limit));
		const body = t.slice(start, end ? start + end.index : limit);
		const version = Number(m[1]);
		if (version === 1) return parseBody(body);
		if (version > 1) return { ok: false, error: 'newer-version', version };
		return { ok: false, error: 'invalid', detail: `unknown version v${m[1] ?? ''}` };
	});
}

function parseBody(body: string): ParsedLeadBlock {
	const raw: Partial<Record<LeadKey, string>> = {};
	let rest = body;
	let previous: LeadKey | null = null;
	for (const [key, pattern] of KEY_PATTERNS) {
		const m = pattern.exec(rest);
		if (!m) return { ok: false, error: 'invalid', detail: `missing ${key}` };
		if (previous) raw[previous] = rest.slice(0, m.index);
		rest = rest.slice(m.index + m[0].length);
		previous = key;
	}
	const single = (key: LeadKey) => cleanText((raw[key] ?? '').replace(WRAP, ' '));

	const email = normEmail(single('email'));
	if (email === null) return { ok: false, error: 'invalid', detail: 'email' };
	const lead: ParsedLead = {
		name: single('name'),
		email,
		phone: single('phone'),
		property: single('property'),
		consent: single('consent').toLowerCase() === 'yes',
		submitted: single('submitted'),
		message: cleanText(rest)
	};
	const checked = leadLimits.safeParse(lead);
	if (!checked.success) {
		const fields = checked.error.issues.map((issue) => issue.path.join('.'));
		return { ok: false, error: 'invalid', detail: [...new Set(fields)].join(', ') };
	}
	return { ok: true, lead };
}
