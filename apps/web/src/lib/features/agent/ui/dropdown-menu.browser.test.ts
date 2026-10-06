// Real-browser checks for the dropdown-menu copy-in as the board's Move menu (08-10): radio items
// expose the current stage as aria-checked, arrow keys move, Enter selects and closes, Escape
// closes and returns focus to the trigger, and the open menu is axe-clean.
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import MoveMenuHarness from './testing/MoveMenuHarness.svelte';

const items = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
const trigger = () => document.getElementById('move-trigger') as HTMLButtonElement;

async function open(initial = 'touring') {
	const onmove = vi.fn();
	await render(MoveMenuHarness, { props: { initial: initial as 'touring', onmove } });
	trigger().focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(items()).toHaveLength(5));
	return { onmove };
}

describe('dropdown-menu Move menu', () => {
	test('current stage is checked and items carry the 44px class', async () => {
		await open();
		const checked = items().filter((el) => el.getAttribute('aria-checked') === 'true');
		expect(checked.map((el) => el.textContent?.trim())).toEqual(['Touring']);
		// Tailwind is not loaded in the component project, so assert the 44px class, not layout.
		for (const el of items()) expect(el.className).toContain('min-h-11');
		expect(checked[0].querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
		const menu = document.querySelector('[role="menu"]')!;
		expect(await axeViolations(menu)).toEqual([]);
	});

	test('arrow keys move and Enter selects then closes', async () => {
		const { onmove } = await open('new');
		await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toMatch(/menu/));
		await userEvent.keyboard('{ArrowDown}');
		await userEvent.keyboard('{ArrowDown}');
		const highlighted = document.querySelector('[data-highlighted]');
		expect(highlighted?.textContent?.trim()).toBeTruthy();
		const label = highlighted!.textContent!.trim();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(items()).toHaveLength(0));
		expect(onmove).toHaveBeenCalledTimes(1);
		expect(['Contacted', 'Touring']).toContain(label);
	});

	test('Escape closes and returns focus to the trigger', async () => {
		const { onmove } = await open();
		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(items()).toHaveLength(0));
		await vi.waitFor(() => expect(document.activeElement).toBe(trigger()));
		expect(onmove).not.toHaveBeenCalled();
	});
});
