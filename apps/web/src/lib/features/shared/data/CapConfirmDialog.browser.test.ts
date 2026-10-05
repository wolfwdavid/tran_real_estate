import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import { announcerMessage } from '$lib/components/a11y/announcer.svelte';
import CapConfirmDialog from './CapConfirmDialog.svelte';

const BODY_A =
	"You set a cap of 40 calls this month, and you've used 40. This call is still inside the 50 calls in RentCast's free plan, so it doesn't add a charge. RentCast bills overage at $0.20 per call, charged to your card if your RentCast account has one on file, once you pass 50.";
const BODY_B =
	"This would be call 51 this month, past the 50 in RentCast's free plan. RentCast bills overage at $0.20 per call. If your RentCast account has a card on file, RentCast charges this call to your card. Tran never bills you. Without a card, RentCast may refuse the call.";

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => (resolve = r));
	return { promise, resolve };
}

async function open(used: number, cap: number, onConfirm = vi.fn(async () => {})) {
	const onCancel = vi.fn();
	const confirmSpy = vi.spyOn(window, 'confirm');
	await render(CapConfirmDialog, { props: { open: true, used, cap, onConfirm, onCancel } });
	const dialog = page.getByRole('alertdialog');
	await expect.element(dialog).toBeVisible();
	return {
		dialog,
		onConfirm,
		onCancel,
		confirmSpy,
		notNow: page.getByRole('button', { name: 'Not now' }),
		spend: page.getByRole('button', { name: /Spend 1 call anyway|Spending…/ })
	};
}

/**
 * Component tests load no CSS, so the overlay has no box. A fixed target at the bottom of the
 * viewport stands in for it: proven non-vacuous by flipping interactOutsideBehavior to 'close'.
 */
function plantOutsideTarget(): HTMLElement {
	const el = document.createElement('div');
	el.style.cssText = 'position:fixed;bottom:0;left:0;width:40px;height:40px;pointer-events:auto';
	document.body.appendChild(el);
	return el;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('CapConfirmDialog', () => {
	test('variant A: title, body, facts, primary confirm, initial focus on Not now', async () => {
		const { dialog, notNow, spend, confirmSpy } = await open(40, 40);
		await expect
			.element(page.getByRole('heading', { name: 'This call goes past your cap' }))
			.toBeVisible();
		await expect.element(dialog).toHaveTextContent(BODY_A);
		const dl = dialog.element().querySelector('dl');
		expect(dl).not.toBeNull();
		expect(dl!.textContent).toContain('Used this month: 40 of 50');
		expect(dl!.textContent).toContain('Your cap: 40');
		expect(dl!.textContent).toContain('This action: 1 call');
		await expect.element(notNow).toHaveFocus();
		expect(spend.element().className).toContain('bg-primary');
		expect(spend.element().className).not.toContain('bg-destructive');
		expect(confirmSpy).not.toHaveBeenCalled();
		expect(await axeViolations(dialog.element())).toEqual([]);
	});

	test('variant B: past-plan body and destructive confirm', async () => {
		const { dialog, notNow, spend } = await open(50, 50);
		await expect.element(dialog).toHaveTextContent(BODY_B);
		await expect.element(dialog).toHaveTextContent('Used this month: 50 of 50');
		await expect.element(notNow).toHaveFocus();
		expect(spend.element().className).toContain('bg-destructive');
		expect(await axeViolations(dialog.element())).toEqual([]);
	});

	test('Escape cancels once and announces Nothing was spent.', async () => {
		const { onCancel, onConfirm } = await open(40, 40);
		await userEvent.keyboard('{Escape}');
		await expect.poll(() => onCancel.mock.calls.length).toBe(1);
		expect(onConfirm).not.toHaveBeenCalled();
		await expect.poll(() => announcerMessage()).toBe('Nothing was spent.');
		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
	});

	test('Not now cancels once', async () => {
		const { onCancel, notNow } = await open(40, 40);
		await notNow.click();
		await expect.poll(() => onCancel.mock.calls.length).toBe(1);
		await expect.poll(() => announcerMessage()).toBe('Nothing was spent.');
	});

	test('clicking outside the dialog does not cancel', async () => {
		const outside = plantOutsideTarget();
		const { onCancel, dialog } = await open(40, 40);
		await userEvent.click(outside, { force: true });
		// bits-ui debounces outside-interaction handling by 10ms; give it time to (not) close.
		await new Promise((r) => setTimeout(r, 150));
		await expect.element(dialog).toBeVisible();
		expect(onCancel).not.toHaveBeenCalled();
		outside.remove();
	});

	test('confirm runs once; while pending both buttons are disabled and Escape is ignored', async () => {
		const gate = deferred();
		const onConfirm = vi.fn(() => gate.promise);
		const { spend, notNow, onCancel, confirmSpy } = await open(40, 40, onConfirm);
		await spend.click();
		expect(onConfirm).toHaveBeenCalledTimes(1);
		await expect.element(spend).toHaveTextContent('Spending…');
		await expect.element(spend).toBeDisabled();
		await expect.element(notNow).toBeDisabled();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('alertdialog')).toBeVisible();
		expect(onCancel).not.toHaveBeenCalled();
		gate.resolve();
		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
		expect(confirmSpy).not.toHaveBeenCalled();
	});
});
