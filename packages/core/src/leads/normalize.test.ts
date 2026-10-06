import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
	cleanText,
	firstName,
	formatPhoneUS,
	normalizeText,
	normEmail,
	normPhoneUS
} from './normalize.js';

const HOSTILE = /[\u202A-\u202E\u2066-\u2069\u200B-\u200D\uFEFF]/;

describe('normalizeText', () => {
	it('unifies line endings', () => {
		expect(normalizeText('a\r\nb\rc')).toBe('a\nb\nc');
	});
	it('turns non-breaking spaces into spaces', () => {
		expect(normalizeText('a\u00A0b\u2007c\u202Fd')).toBe('a b c d');
	});
	it('removes zero-width characters', () => {
		expect(normalizeText('a\u200Bb\u200Cc\u200Dd\uFEFFe')).toBe('abcde');
	});
	it('strips leading quote markers per line', () => {
		expect(normalizeText('> > name: Jo\n>email: jo@example.com')).toBe(
			'name: Jo\nemail: jo@example.com'
		);
	});
	it('applies NFKC', () => {
		expect(normalizeText('\uFF4E\uFF41\uFF4D\uFF45')).toBe('name');
	});
});

describe('cleanText', () => {
	it('strips bidi overrides, zero-width chars and trims', () => {
		expect(cleanText('\u202EevilJo\u200B ')).toBe('evilJo');
	});
	it('strips C0 and C1 controls but keeps newline and tab', () => {
		expect(cleanText('a\u0000b\u0007c\u001Bd\u007Fe\u0085f\u009Fg\nh\ti')).toBe('abcdefg\nh\ti');
	});
	it('strips isolates', () => {
		expect(cleanText('\u2066Jo\u2069')).toBe('Jo');
	});
});

describe('normEmail', () => {
	it('trims and lowercases, keeping dots and +tags', () => {
		expect(normEmail('  Jo.Ex+tag@Example.COM ')).toBe('jo.ex+tag@example.com');
	});
	it('rejects malformed addresses', () => {
		expect(normEmail('jo@')).toBeNull();
		expect(normEmail('a b@example.com')).toBeNull();
		expect(normEmail('')).toBeNull();
		expect(normEmail('jo@example')).toBeNull();
	});
});

describe('normPhoneUS', () => {
	it.each([
		'(555) 555-0142',
		'555.555.0142',
		'+1 555 555 0142',
		'1-555-555-0142',
		'5555550142',
		'(555) 555-0142 ext. 12',
		'555-555-0142 x12'
	])('%s -> +15555550142', (raw) => {
		expect(normPhoneUS(raw)).toBe('+15555550142');
	});
	it('rejects area codes and exchanges starting with 0 or 1', () => {
		expect(normPhoneUS('055-555-0142')).toBeNull();
		expect(normPhoneUS('555-055-0142')).toBeNull();
	});
	it('keeps international numbers with a leading +', () => {
		expect(normPhoneUS('+44 20 7946 0958')).toBe('+442079460958');
	});
	it('rejects too-short input', () => {
		expect(normPhoneUS('12345')).toBeNull();
		expect(normPhoneUS('')).toBeNull();
	});
});

describe('formatPhoneUS', () => {
	it('formats NANP E.164 in national format', () => {
		expect(formatPhoneUS('+15555550142')).toBe('(555) 555-0142');
	});
	it('returns other input unchanged', () => {
		expect(formatPhoneUS('+442079460958')).toBe('+442079460958');
	});
});

describe('firstName', () => {
	it('returns the first token', () => {
		expect(firstName('Jordan Example')).toBe('Jordan');
		expect(firstName('  ')).toBe('');
		expect(firstName('Cher')).toBe('Cher');
		expect(firstName('\u202E Jordan')).toBe('Jordan');
	});
});

describe('properties', () => {
	const anyString = fc.string({ unit: 'binary' });
	const RUNS = { numRuns: 200 };

	it('normEmail is idempotent', () => {
		fc.assert(
			fc.property(anyString, (x) => {
				const once = normEmail(x);
				expect(normEmail(once ?? x)).toBe(once);
			}),
			RUNS
		);
	});

	it('normEmail is idempotent on email-shaped input', () => {
		fc.assert(
			fc.property(fc.emailAddress(), (x) => {
				const once = normEmail(x.toUpperCase());
				expect(once).not.toBeNull();
				expect(normEmail(once!)).toBe(once);
			}),
			RUNS
		);
	});

	it('normPhoneUS is idempotent on its non-null output', () => {
		const phoneish = fc.oneof(
			anyString,
			fc.stringMatching(/^\+?1?[ .-]?\(?[2-9]\d{2}\)?[ .-]?[2-9]\d{2}[ .-]?\d{4}$/),
			fc.stringMatching(/^\+\d{8,15}$/)
		);
		fc.assert(
			fc.property(phoneish, (x) => {
				const once = normPhoneUS(x);
				if (once !== null) expect(normPhoneUS(once)).toBe(once);
			}),
			RUNS
		);
	});

	it('cleanText is idempotent', () => {
		fc.assert(
			fc.property(anyString, (s) => {
				const once = cleanText(s);
				expect(cleanText(once)).toBe(once);
			}),
			RUNS
		);
	});

	it('cleanText output never contains bidi or zero-width characters', () => {
		const hostile = fc.constantFrom(
			'\u202A',
			'\u202B',
			'\u202C',
			'\u202D',
			'\u202E',
			'\u2066',
			'\u2067',
			'\u2068',
			'\u2069',
			'\u200B',
			'\u200C',
			'\u200D',
			'\uFEFF'
		);
		const mixed = fc.array(fc.oneof(anyString, hostile)).map((parts) => parts.join(''));
		fc.assert(
			fc.property(mixed, (s) => {
				expect(HOSTILE.test(cleanText(s))).toBe(false);
			}),
			RUNS
		);
	});
});
