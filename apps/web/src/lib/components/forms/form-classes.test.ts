// DEBT-09: static form button classes stay token-equal to buttonVariants(); mutation proof in 14-09-SUMMARY.md.
import { describe, expect, it } from 'vitest';
import { buttonVariants } from '$lib/components/ui/button/button.svelte';
import { GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from './form-classes';

const tokens = (s: string) => new Set(s.split(' ').filter(Boolean));

const REQUIRED = [
	'text-body',
	'font-semibold',
	'h-12',
	'min-w-11',
	'focus-visible:outline-2',
	'focus-visible:outline-offset-2',
	'focus-visible:outline-ring'
];

describe('form button classes', () => {
	it('PRIMARY_BUTTON_CLASS is token-equal to the Button default variant', () => {
		expect(tokens(PRIMARY_BUTTON_CLASS)).toEqual(tokens(buttonVariants()));
	});

	it('GHOST_BUTTON_CLASS is token-equal to the Button ghost variant', () => {
		expect(tokens(GHOST_BUTTON_CLASS)).toEqual(tokens(buttonVariants({ variant: 'ghost' })));
	});

	it.each([
		['primary', PRIMARY_BUTTON_CLASS],
		['ghost', GHOST_BUTTON_CLASS]
	])('%s keeps the type, size and focus ring tokens', (_name, cls) => {
		const t = tokens(cls);
		for (const token of REQUIRED) expect(t.has(token), token).toBe(true);
	});

	it('neither string repeats a token', () => {
		for (const cls of [PRIMARY_BUTTON_CLASS, GHOST_BUTTON_CLASS]) {
			const list = cls.split(' ').filter(Boolean);
			expect(list.length).toBe(new Set(list).size);
		}
	});
});
