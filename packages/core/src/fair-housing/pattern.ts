/** Tolerant separator: whitespace, no-break space or hyphen (one or more). */
const SEP = '[\\s\\u00A0-]+';
/** Straight or curly apostrophe. */
const APOS = "['’]";

function unsafe(source: string): never {
	throw new Error('Unsafe lexicon pattern: ' + source);
}

/** Index just past a character class that opens at `start` (source[start] === '['). */
function skipClass(source: string, start: number): number {
	let i = start + 1;
	if (source[i] === '^') i++;
	if (source[i] === ']') i++; // a leading ']' is literal
	while (i < source.length && source[i] !== ']') {
		i += source[i] === '\\' ? 2 : 1;
	}
	return i + 1;
}

/** Index just past an escape sequence that opens at `start` (source[start] === '\\'). */
function skipEscape(source: string, start: number): number {
	const kind = source[start + 1];
	if ((kind === 'p' || kind === 'P' || kind === 'u' || kind === 'k') && source[start + 2] === '{') {
		const close = source.indexOf('}', start + 3);
		return close === -1 ? source.length : close + 1;
	}
	if (kind === 'k' && source[start + 2] === '<') {
		const close = source.indexOf('>', start + 3);
		return close === -1 ? source.length : close + 1;
	}
	return start + 2;
}

/** Length of an unbounded quantifier ('+', '*' or '{n,}') at `i`, else 0. */
function unboundedQuantifierAt(source: string, i: number): number {
	const ch = source[i];
	if (ch === '+' || ch === '*') return 1;
	if (ch === '{') {
		const m = /^\{\d+,\}/.exec(source.slice(i));
		return m ? m[0].length : 0;
	}
	return 0;
}

/**
 * ReDoS guard. Throws when a group whose body contains an unbounded quantifier
 * ('+', '*' or '{n,}', including one applied to a nested group) is itself
 * followed by '+', '*' or '{'. Escapes and character-class contents are skipped.
 */
export function assertSafePattern(source: string): void {
	// Each open group records whether its body has an unbounded quantifier so far.
	const stack: boolean[] = [];
	let i = 0;
	while (i < source.length) {
		const ch = source[i];
		if (ch === '\\') {
			i = skipEscape(source, i);
			continue;
		}
		if (ch === '[') {
			i = skipClass(source, i);
			continue;
		}
		if (ch === '(') {
			stack.push(false);
			i++;
			continue;
		}
		if (ch === ')') {
			const bodyQuantified = stack.pop() ?? false;
			const next = source[i + 1];
			if (bodyQuantified && (next === '+' || next === '*' || next === '{')) unsafe(source);
			// The nested group's contents are part of the parent's body.
			if (bodyQuantified && stack.length > 0) stack[stack.length - 1] = true;
			i++;
			continue;
		}
		const len = unboundedQuantifierAt(source, i);
		if (len > 0) {
			if (stack.length > 0) stack[stack.length - 1] = true;
			i += len;
			continue;
		}
		i++;
	}
}

/**
 * Lexicon authoring helper. Interpolates like String.raw, then makes the source
 * tolerant: every run of spaces/hyphens becomes `[\s\u00A0-]+` and every `'`
 * matches a straight or curly apostrophe.
 *
 * Authors must NOT put a literal space or hyphen inside a `[...]` character
 * class (the transform would corrupt it); such patterns are rejected here, on
 * the authored string, before the transform runs. Nested unbounded quantifiers
 * are rejected by `assertSafePattern`.
 */
export function p(strings: TemplateStringsArray, ...values: string[]): string {
	let authored = '';
	strings.raw.forEach((chunk, index) => {
		authored += chunk + (index < values.length ? values[index] : '');
	});

	for (let i = 0; i < authored.length;) {
		if (authored[i] === '\\') {
			i = skipEscape(authored, i);
		} else if (authored[i] === '[') {
			const end = skipClass(authored, i);
			if (/[ -]/.test(authored.slice(i + 1, end - 1))) unsafe(authored);
			i = end;
		} else {
			i++;
		}
	}

	const result = authored.replace(/[ -]+/g, SEP).replace(/'/g, APOS);
	assertSafePattern(result);
	return result;
}

const cache = new Map<string, RegExp>();

/**
 * Wraps a lexicon source in Unicode-aware boundaries (JS `\b` is ASCII-only)
 * and compiles it with 'giu'. Always returns a fresh RegExp so callers never
 * share `lastIndex`.
 */
export function compilePattern(source: string): RegExp {
	let cached = cache.get(source);
	if (!cached) {
		cached = new RegExp('(?<![\\p{L}\\p{N}])(?:' + source + ')(?![\\p{L}\\p{N}])', 'giu');
		cache.set(source, cached);
	}
	return new RegExp(cached.source, cached.flags);
}
