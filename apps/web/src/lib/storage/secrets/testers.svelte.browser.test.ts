// The key tester registry must be reactive. Settings registers the four AI testers in the AI
// drafting section's onMount (a dynamic import), while the page's own onMount loads the vault. When
// a remembered key's card renders first, its `{#if hasKeyTester(id)}` block must update once the
// tester arrives; with a plain Map it never re-ran and the card showed no Test connection.
import { afterEach, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { _resetKeyTesters, hasKeyTester, registerKeyTester } from './testers';

afterEach(() => _resetKeyTesters());

test('a reader of hasKeyTester re-runs when a tester registers and unregisters', () => {
	const seen: boolean[] = [];
	const dispose = $effect.root(() => {
		$effect(() => {
			seen.push(hasKeyTester('anthropic'));
		});
	});
	try {
		flushSync();
		expect(seen).toEqual([false]);

		const off = registerKeyTester('anthropic', async () => ({ status: 'accepted' }));
		flushSync();
		expect(seen).toEqual([false, true]);

		off();
		flushSync();
		expect(seen).toEqual([false, true, false]);
	} finally {
		dispose();
	}
});
