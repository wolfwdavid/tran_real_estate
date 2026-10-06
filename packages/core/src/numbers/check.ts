import type { NumeralToken } from './extract.js';

export const NUMERIC_CATEGORY = 'numeric-provenance';

export interface AllowedNumber {
	value: number;
	source?: string;
}

export interface NumberFinding {
	start: number;
	end: number;
	text: string;
	severity: 'block' | 'warn';
	category: string;
	reason: 'not-in-allowed' | 'spelled-out';
}

export function matchesAllowed(_tok: NumeralToken, _allowed: number): boolean {
	throw new Error('not implemented');
}

export function checkNumbers(
	_text: string,
	_allowed: readonly (number | AllowedNumber)[],
	_opts?: { category?: string }
): NumberFinding[] {
	throw new Error('not implemented');
}

export function allowedFromText(_text: string, _source?: string): AllowedNumber[] {
	throw new Error('not implemented');
}
