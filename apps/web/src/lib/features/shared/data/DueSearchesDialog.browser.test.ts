import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import { announcerMessage } from '$lib/components/a11y/announcer.svelte';
import DueSearchesDialog from './DueSearchesDialog.svelte';

const BODY =
	"These searches haven't been checked in over a day. Checking them uses RentCast calls from your monthly count.";
const PARTIAL =
	'Only 2 fit under your cap, so Tran will check the 2 that have waited longest. The rest wait until you raise your cap or your count resets.';

const names = (count: number) => Array.from({ length: count }, (_, i) => `Search ${i + 1}`);

interface Opts {
	names?: string[];
	dueCount?: number;
	runCount?: number;
	calls?: number;
	used?: number;
	cap?: number;
	progress?: { i: number; k: number } | null;
	onConfirm?: () => Promise<void>;
}

async function open(opts: Opts = {}) {
	const list = opts.names ?? names(5);
	const onConfirm = vi.fn(opts.onConfirm ?? (async () => {}));
	const onDecline = vi.fn();
	await render(DueSearchesDialog, {
		props: {
			open: true,
			names: list,
			dueCount: opts.dueCount ?? list.length,
			runCount: opts.runCount ?? list.length,
			calls: opts.calls ?? opts.runCount ?? list.length,
			used: opts.used ?? 0,
			cap: opts.cap ?? 40,
			progress: opts.progress ?? null,
			onConfirm,
			onDecline
		}
	});
	const dialog = page.getByRole('alertdialog');
	await expect.element(dialog).toBeVisible();
	return {
		dialog,
		onConfirm,
		onDecline,
		notNow: page.getByRole('button', { name: 'Not now' })
	};
}

/** A fixed element outside the dialog stands in for the overlay (no CSS loads in these tests). */
function plantOutsideTarget(): HTMLElement {
	const el = document.createElement('div');
	el.style.cssText = 'position:fixed;bottom:0;left:0;width:40px;height:40px;pointer-events:auto';
	document.body.appendChild(el);
	return el;
}

/** The `<main tabindex="-1">` that focus returns to (the dialog opens on load with no trigger). */
function plantMain(): HTMLElement {
	const main = document.createElement('main');
	main.tabIndex = -1;
	main.textContent = 'Page';
	document.body.appendChild(main);
	return main;
}

afterEach(() => {
	document.querySelectorAll('body > main').forEach((m) => m.remove());
	vi.restoreAllMocks();
});

describe('DueSearchesDialog', () => {
	test('title, body, list, facts, confirm name and initial focus', async () => {
		const { dialog, notNow } = await open();
		await expect
			.element(page.getByRole('heading', { name: 'Check 5 saved searches for new listings?' }))
			.toBeVisible();
		await expect.element(dialog).toHaveTextContent(BODY);
		expect(dialog.element().textContent).not.toContain('Only ');
		const items = dialog.element().querySelectorAll('ul > li');
		expect(items.length).toBe(5);
		expect(items[0].textContent!.trim()).toBe('Search 1');
		const dl = dialog.element().querySelector('dl');
		expect(dl).not.toBeNull();
		const facts = dl!.textContent!.replace(/\s+/g, ' ');
		expect(facts).toContain('Calls this check uses: 5');
		expect(facts).toContain('Used this month: 0 of 50');
		expect(facts).toContain('Left before your cap: 40');
		await expect
			.element(page.getByRole('button', { name: 'Check 5 searches (5 calls)' }))
			.toBeVisible();
		await expect.element(notNow).toHaveFocus();
		expect(await axeViolations(dialog.element())).toEqual([]);
	});

	test('12 names: 10 list items plus "and 2 more"', async () => {
		const { dialog } = await open({ names: names(12) });
		expect(dialog.element().querySelectorAll('ul > li').length).toBe(10);
		await expect.element(dialog).toHaveTextContent('and 2 more');
		expect(await axeViolations(dialog.element())).toEqual([]);
	});

	test('partial fit: sentence and confirm for the runnable count', async () => {
		const { dialog } = await open({ names: names(5), dueCount: 5, runCount: 2, used: 38 });
		await expect.element(dialog).toHaveTextContent(PARTIAL);
		await expect
			.element(page.getByRole('button', { name: 'Check 2 searches (2 calls)' }))
			.toBeVisible();
		expect(dialog.element().querySelector('dl')!.textContent!.replace(/\s+/g, ' ')).toContain(
			'Left before your cap: 2'
		);
		expect(await axeViolations(dialog.element())).toEqual([]);
	});

	test('shared cache key: 2 searches, 1 call', async () => {
		await open({ names: names(5), dueCount: 5, runCount: 2, calls: 1 });
		await expect
			.element(page.getByRole('button', { name: 'Check 2 searches (1 call)' }))
			.toBeVisible();
	});

	test('progress: confirm reads Checking 1 of 5… and both buttons are disabled', async () => {
		const { notNow, onDecline } = await open({ progress: { i: 1, k: 5 } });
		const confirm = page.getByRole('button', { name: 'Checking 1 of 5…' });
		await expect.element(confirm).toBeVisible();
		await expect.element(confirm).toBeDisabled();
		await expect.element(notNow).toBeDisabled();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('alertdialog')).toBeVisible();
		expect(onDecline).not.toHaveBeenCalled();
	});

	test('Not now declines once, announces, and returns focus to <main>', async () => {
		const main = plantMain();
		const { notNow, onDecline, onConfirm } = await open();
		await notNow.click();
		await expect.poll(() => onDecline.mock.calls.length).toBe(1);
		expect(onConfirm).not.toHaveBeenCalled();
		await expect
			.poll(() => announcerMessage())
			.toBe("Saved searches weren't checked. Tran will ask again next time you open it.");
		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		await expect.poll(() => document.activeElement).toBe(main);
	});

	test('Escape declines once', async () => {
		const { onDecline } = await open();
		await userEvent.keyboard('{Escape}');
		await expect.poll(() => onDecline.mock.calls.length).toBe(1);
		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		await new Promise((r) => setTimeout(r, 50));
		expect(onDecline).toHaveBeenCalledTimes(1);
	});

	test('clicking outside does nothing', async () => {
		const outside = plantOutsideTarget();
		const { dialog, onDecline } = await open();
		await userEvent.click(outside, { force: true });
		await new Promise((r) => setTimeout(r, 150));
		await expect.element(dialog).toBeVisible();
		expect(onDecline).not.toHaveBeenCalled();
		outside.remove();
	});

	test('confirm calls onConfirm once', async () => {
		const { onConfirm, onDecline } = await open();
		await page.getByRole('button', { name: 'Check 5 searches (5 calls)' }).click();
		await expect.poll(() => onConfirm.mock.calls.length).toBe(1);
		expect(onDecline).not.toHaveBeenCalled();
	});
});
