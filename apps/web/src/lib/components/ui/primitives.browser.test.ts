// DEBT-06: real-Chromium computed font-size for Badge/Button + axe on the copied-in primitives; mutation proof in 14-06-SUMMARY.md.
import '../../../app.css';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import PrimitivesHarness from './PrimitivesHarness.svelte';

function probe(container: Element, selector: string): CSSStyleDeclaration {
	const el = container.querySelector(selector);
	expect(el, selector).not.toBeNull();
	return getComputedStyle(el as Element);
}

describe('copied-in primitives in real Chromium', () => {
	test('sanity: Tailwind utility CSS is loaded (font-semibold computes 600)', async () => {
		const { container } = await render(PrimitivesHarness);
		expect(probe(container, '[data-sanity]').fontWeight).toBe('600');
		expect(probe(container, '[data-harness]').fontSize).toBe('20px');
	});

	test('default Badge renders the Label token: 14px / 19.6px / 600', async () => {
		const { container } = await render(PrimitivesHarness);
		const style = probe(container, '[data-probe="badge"]');
		expect(style.fontSize).toBe('14px');
		expect(style.lineHeight).toBe('19.6px');
		expect(style.fontWeight).toBe('600');
	});

	test('default Button renders the Body token: 16px / 25.6px / 600', async () => {
		const { container } = await render(PrimitivesHarness);
		const style = probe(container, '[data-probe="button"]');
		expect(style.fontSize).toBe('16px');
		expect(style.lineHeight).toBe('25.6px');
		expect(style.fontWeight).toBe('600');
	});

	test('axe: Badge (3 variants), Button (every variant and size), Alert (2 variants) are clean', async () => {
		const { container } = await render(PrimitivesHarness);
		expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(3);
		expect(container.querySelectorAll('[data-slot="button"]')).toHaveLength(7);
		expect(container.querySelectorAll('[data-slot="alert"]')).toHaveLength(2);
		expect(await axeViolations(container)).toEqual([]);
	});
});
