// DEBT-06 (04-14 deferred): the --text-* tokens survive cn() and tv() merges; mutation proof recorded in 14-06-SUMMARY.md.
import { describe, expect, test } from 'vitest';
import { cn, TW_MERGE_CONFIG } from './utils';
import { badgeVariants } from './components/ui/badge/badge.svelte';
import { buttonVariants } from './components/ui/button/button.svelte';

const classes = (s: string) => s.split(' ');

describe('cn() keeps the --text-* font-size tokens next to text colours', () => {
	test('text-label survives text-muted-foreground', () => {
		const out = classes(cn('text-label text-muted-foreground'));
		expect(out).toContain('text-label');
		expect(out).toContain('text-muted-foreground');
	});

	test.each([
		['text-body', 'text-primary-foreground'],
		['text-heading', 'text-foreground'],
		['text-display', 'text-foreground']
	])('%s survives %s', (size, colour) => {
		const out = classes(cn(`${size} ${colour}`));
		expect(out).toContain(size);
		expect(out).toContain(colour);
	});

	test('a later font-size utility still wins over a token', () => {
		expect(cn('text-label text-sm')).toBe('text-sm');
	});
});

describe('tv() instances share the merge config', () => {
	test.each([undefined, 'positive', 'attention'] as const)(
		'badgeVariants(%s) keeps text-label',
		(variant) => {
			expect(classes(badgeVariants(variant ? { variant } : undefined))).toContain('text-label');
		}
	);

	test('buttonVariants() keeps text-body and text-primary-foreground', () => {
		const out = classes(buttonVariants());
		expect(out).toContain('text-body');
		expect(out).toContain('text-primary-foreground');
	});

	test('TW_MERGE_CONFIG lists exactly the four app.css tokens', () => {
		expect(TW_MERGE_CONFIG.extend.classGroups['font-size']).toEqual([
			{ text: ['label', 'body', 'heading', 'display'] }
		]);
	});
});
