// Real-browser checks for the parts SSR cannot exercise: the popover opens from the keyboard,
// moves focus to its primary action, closes on Escape back to the trigger, and passes axe.
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { checkFairHousing } from '@tran/core/fair-housing';
import { axeViolations } from '$lib/testing/axe';
import FairHousingText from './FairHousingText.svelte';
import FindingsSummary from './FindingsSummary.svelte';

const TEXT = 'Perfect for young professionals. It is walking distance to church.';

const triggers = (root: HTMLElement) =>
	[...root.querySelectorAll<HTMLButtonElement>('button.finding-trigger')] as HTMLButtonElement[];

describe('FairHousingText popover', () => {
	test('Enter opens a labelled dialog with focus on Use alternative; Escape returns focus', async () => {
		const findings = checkFairHousing(TEXT);
		const { container } = await render(FairHousingText, {
			props: { text: TEXT, findings, idPrefix: 'bt' }
		});
		const [block] = triggers(container);
		block.focus();
		await userEvent.keyboard('{Enter}');

		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
		expect(block.getAttribute('aria-expanded')).toBe('true');
		expect(block.getAttribute('aria-controls')).toBe(dialog.id);
		const heading = document.getElementById(dialog.getAttribute('aria-labelledby')!)!;
		expect(heading.textContent).toContain('Must fix');
		expect(heading.textContent).toContain('Category: Familial status');
		await vi.waitFor(() =>
			expect(document.activeElement?.textContent?.trim()).toBe('Use alternative')
		);

		expect(await axeViolations(document.body)).toEqual([]);

		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
		await vi.waitFor(() => expect(document.activeElement).toBe(block));
	});

	test('Use alternative closes the popover and reports the finding id', async () => {
		const findings = checkFairHousing(TEXT);
		const onApply = vi.fn();
		const { container } = await render(FairHousingText, {
			props: { text: TEXT, findings, idPrefix: 'bt2', onApply }
		});
		const [, warn] = triggers(container);
		await userEvent.click(warn);
		await vi.waitFor(() => expect(document.querySelector('[data-finding-apply]')).not.toBeNull());
		await userEvent.click(document.querySelector<HTMLElement>('[data-finding-apply]')!);
		expect(onApply).toHaveBeenCalledWith(findings[1].id);
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
	});

	test('closed highlights pass axe', async () => {
		const { container } = await render(FairHousingText, {
			props: { text: TEXT, findings: checkFairHousing(TEXT), idPrefix: 'bt3' }
		});
		expect(await axeViolations(container)).toEqual([]);
	});
});

describe('FindingsSummary', () => {
	test('findings list and acknowledgement pass axe; the checkbox toggles', async () => {
		const warnOnly = checkFairHousing(TEXT).filter((f) => f.severity === 'warn');
		const { container } = await render(FindingsSummary, {
			props: { findings: warnOnly, idPrefix: 'bs', headingLevel: 3 }
		});
		expect(await axeViolations(container)).toEqual([]);
		const box = container.querySelector<HTMLElement>('[role="checkbox"]')!;
		await userEvent.click(box);
		expect(box.getAttribute('aria-checked')).toBe('true');
	});

	test('no findings strip passes axe', async () => {
		const { container } = await render(FindingsSummary, {
			props: { findings: [], idPrefix: 'bn', headingLevel: 4 }
		});
		expect(await axeViolations(container)).toEqual([]);
	});
});
