// RFC 4180 CSV serializer and parser (AGT-07). Hand-written and dependency-free on purpose: the
// origin holds API keys, so every dependency is supply-chain surface (RESEARCH "Don't Hand-Roll").
//
// Export rules: UTF-8 BOM (Excel), every field quoted, CRLF row endings, OWASP formula-injection
// escaping (a leading = + - @ tab CR LF gains an apostrophe). Import is lenient: BOM optional,
// CR / LF / CRLF line endings, unquoted fields, comma or semicolon delimiter.

/** OWASP CSV-injection leading characters. */
const TRIGGER = /^[=+\-@\t\r\n]/;
/** One or more apostrophes followed by a trigger: an escaped (or escape-looking) value. */
const ESCAPED = /^'+[=+\-@\t\r\n]/;

export type CsvDelimiter = ',' | ';';

export class CsvError extends Error {
	constructor(public readonly code: 'unterminated-quote') {
		super(`CSV error: ${code}`);
		this.name = 'CsvError';
	}
}

/**
 * Prefixes an apostrophe when the value starts with a formula trigger, or already looks escaped
 * (apostrophes then a trigger). The second case keeps the mapping injective, so unescapeFormula is
 * an exact inverse.
 */
export const escapeFormula = (v: string): string =>
	TRIGGER.test(v) || ESCAPED.test(v) ? `'${v}` : v;

/** Exact inverse of escapeFormula: unescapeFormula(escapeFormula(v)) === v for every v. */
export const unescapeFormula = (v: string): string => (ESCAPED.test(v) ? v.slice(1) : v);

/** Serializes rows with a BOM, every field quoted and escaped, CRLF after every row. */
export function toCsv(rows: readonly (readonly string[])[]): string {
	const line = (r: readonly string[]) =>
		r.map((v) => `"${escapeFormula(v).replace(/"/g, '""')}"`).join(',');
	return '\uFEFF' + rows.map(line).join('\r\n') + (rows.length ? '\r\n' : '');
}

const stripBom = (s: string): string => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/**
 * Parses RFC 4180 text into rows of strings. A leading BOM is ignored; a trailing line ending does
 * not produce an extra row. Throws CsvError('unterminated-quote') for an unclosed quoted field.
 */
export function parseCsv(input: string, delimiter: CsvDelimiter = ','): string[][] {
	const s = stripBom(input);
	const rows: string[][] = [];
	let row: string[] = [];
	let f = '';
	let inQuotes = false;
	let quotedField = false;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (inQuotes) {
			if (c === '"') {
				if (s[i + 1] === '"') {
					f += '"';
					i++;
				} else inQuotes = false;
			} else f += c;
		} else if (c === '"' && f === '' && !quotedField) {
			inQuotes = true;
			quotedField = true;
		} else if (c === delimiter) {
			row.push(f);
			f = '';
			quotedField = false;
		} else if (c === '\r' || c === '\n') {
			row.push(f);
			rows.push(row);
			row = [];
			f = '';
			quotedField = false;
			if (c === '\r' && s[i + 1] === '\n') i++;
		} else f += c;
	}
	if (inQuotes) throw new CsvError('unterminated-quote');
	if (f !== '' || row.length || quotedField) {
		row.push(f);
		rows.push(row);
	}
	return rows;
}

/**
 * Picks ',' or ';' by counting unquoted occurrences on the first line (a BOM is ignored and the
 * scan stops at the first unquoted line ending). A tie or neither means ','.
 */
export function detectDelimiter(firstLine: string): CsvDelimiter {
	const s = stripBom(firstLine);
	let commas = 0;
	let semicolons = 0;
	let inQuotes = false;
	for (const c of s) {
		if (c === '"') inQuotes = !inQuotes;
		else if (inQuotes) continue;
		else if (c === ',') commas++;
		else if (c === ';') semicolons++;
		else if (c === '\r' || c === '\n') break;
	}
	return semicolons > commas ? ';' : ',';
}
