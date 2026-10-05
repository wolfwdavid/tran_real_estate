import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { axeViolations } from '$lib/testing/axe';
import { announcerMessage } from '$lib/components/a11y/announcer.svelte';
import CapEditor from './CapEditor.svelte';

const HELPER_40 =
	"Tran stops before call 41 and asks you first. RentCast's free plan includes 50 calls a month. We suggest 40, which leaves room for a few extra searches.";
const HELPER_ABOVE =
	"That's more than the 50 calls in RentCast's free plan. You'll be asked to confirm, because RentCast can bill calls past 50.";

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => (resolve = r));
	return { promise, resolve };
}

async function mount(opts: {
	cap?: number;
	used?: number;
	onSave?: (cap: number) => Promise<void>;
}) {
	const onSave = vi.fn(opts.onSave ?? (async () => {}));
	const screen = await render(CapEditor, {
		props: { cap: opts.cap ?? 40, used: opts.used ?? 0, onSave }
	});
	return {
		container: screen.container,
		onSave,
		input: page.getByLabelText('Monthly call cap'),
		save: page.getByRole('button', { name: /Save cap|Saving…/ })
	};
}

async function typeCap(value: string): Promise<void> {
	const input = page.getByLabelText('Monthly call cap');
	await input.clear();
	if (value !== '') await input.fill(value);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('CapEditor', () => {
	test('prefills the saved cap with a numeric text input, label, suffix and helper', async () => {
		const { input, container } = await mount({ cap: 40 });
		await expect.element(input).toHaveValue('40');
		const el = input.element() as HTMLInputElement;
		expect(el.type).toBe('text');
		expect(el.getAttribute('inputmode')).toBe('numeric');
		expect(el.getAttribute('pattern')).toBe('[0-9]*');
		const describedBy = el.getAttribute('aria-describedby') ?? '';
		expect(describedBy.split(' ').length).toBeGreaterThanOrEqual(1);
		const helper = document.getElementById(describedBy.split(' ')[0]!);
		expect(helper?.textContent?.trim()).toBe(HELPER_40);
		await expect.element(page.getByText('calls a month', { exact: true })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Save cap' })).toBeVisible();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('the helper follows the typed value live', async () => {
		await mount({ cap: 40 });
		await typeCap('12');
		await expect
			.element(page.getByText('Tran stops before call 13 and asks you first.', { exact: false }))
			.toBeVisible();
		await typeCap('60');
		await expect.element(page.getByText(HELPER_ABOVE)).toBeVisible();
		await typeCap('50');
		await expect
			.element(page.getByText('Tran stops before call 51 and asks you first.', { exact: false }))
			.toBeVisible();
	});

	test.each([
		['', 'Enter a number of calls, from 1 to 1,000.'],
		['4.5', 'Use a whole number, like 40.'],
		['0', 'The cap has to be at least 1. To stop all RentCast calls, choose Sample data below.'],
		['1001', 'Enter 1,000 or less.']
	])('rejects %j with the UI-SPEC message', async (value, message) => {
		const { input, save, onSave, container } = await mount({ cap: 40 });
		await typeCap(value);
		await save.click();
		await expect.element(page.getByText(message)).toBeVisible();
		await expect.element(input).toHaveAttribute('aria-invalid', 'true');
		await expect.element(input).toHaveFocus();
		const errorId = page.getByText(message).element().closest('[id]')?.id;
		expect(errorId).toBeTruthy();
		expect(input.element().getAttribute('aria-describedby')).toContain(errorId!);
		expect(onSave).not.toHaveBeenCalled();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('saving 25 with the button: pending label, saved line with icon, announced, focus kept', async () => {
		const gate = deferred();
		const { save, onSave, container } = await mount({ cap: 40, onSave: () => gate.promise });
		await typeCap('25');
		await save.click();
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenCalledWith(25);
		await expect.element(save).toHaveTextContent('Saving…');
		gate.resolve();
		const saved = page.getByText('Cap saved: 25 calls a month.');
		await expect.element(saved).toBeVisible();
		expect(saved.element().closest('p')?.querySelector('svg.lucide-circle-check')).not.toBeNull();
		await expect.poll(() => announcerMessage()).toBe('Cap saved: 25 calls a month.');
		await expect.element(page.getByRole('button', { name: 'Save cap' })).toHaveFocus();
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(await axeViolations(container)).toEqual([]);
	});

	test('Enter in the input submits', async () => {
		const { input, onSave } = await mount({ cap: 40 });
		await typeCap('25');
		await input.click();
		await userEvent.keyboard('{Enter}');
		await expect.poll(() => onSave.mock.calls.length).toBe(1);
		expect(onSave).toHaveBeenCalledWith(25);
		await expect.element(page.getByText('Cap saved: 25 calls a month.')).toBeVisible();
	});

	test('a cap below current usage adds the next-call note', async () => {
		const { save } = await mount({ cap: 40, used: 30 });
		await typeCap('20');
		await save.click();
		await expect.element(page.getByText('Cap saved: 20 calls a month.')).toBeVisible();
		await expect
			.element(
				page.getByText("You've already used 30 calls this month, so the next call will ask first.")
			)
			.toBeVisible();
	});

	test('a failed save shows the error and focuses the input', async () => {
		const { input, save } = await mount({
			cap: 40,
			onSave: async () => {
				throw new Error('write failed');
			}
		});
		await typeCap('25');
		await save.click();
		await expect.element(page.getByText("Couldn't save your cap. Try again.")).toBeVisible();
		await expect.element(input).toHaveFocus();
		expect(page.getByText('Cap saved:', { exact: false }).elements()).toHaveLength(0);
	});
});

describe('CapAboveLimitDialog (through CapEditor)', () => {
	async function openAbove() {
		const ctx = await mount({ cap: 40 });
		await typeCap('60');
		await ctx.save.click();
		const dialog = page.getByRole('alertdialog');
		await expect.element(dialog).toBeVisible();
		return {
			...ctx,
			dialog,
			keep: page.getByRole('button', { name: 'Keep cap at 40' }),
			setCap: page.getByRole('button', { name: /Set cap to 60|Saving…/ }),
			word: page.getByLabelText('Type overage to confirm')
		};
	}

	test('title, cost body, field attributes and initial focus on Keep cap', async () => {
		const { dialog, keep, setCap, word, onSave } = await openAbove();
		await expect
			.element(page.getByRole('heading', { name: "Allow calls past RentCast's free 50?" }))
			.toBeVisible();
		await expect.element(dialog).toHaveTextContent('up to 10 calls a month');
		await expect.element(dialog).toHaveTextContent('$2.00 a month');
		await expect.element(dialog).toHaveTextContent('Tran never bills you.');
		await expect.element(keep).toHaveFocus();
		const el = word.element() as HTMLInputElement;
		expect(el.getAttribute('autocomplete')).toBe('off');
		expect(el.getAttribute('autocapitalize')).toBe('off');
		expect(el.getAttribute('spellcheck')).toBe('false');
		await expect.element(setCap).toBeEnabled();
		expect(setCap.element().className).toContain('bg-destructive');
		expect(onSave).not.toHaveBeenCalled();
		expect(await axeViolations(dialog.element())).toEqual([]);
	});

	test("a near-miss word shows the field error and never saves; 'Overage ' saves 60", async () => {
		const { setCap, word, onSave, dialog } = await openAbove();
		await word.fill('overag');
		await setCap.click();
		await expect
			.element(page.getByText('Type the word overage to confirm, or choose Keep cap at 40.'))
			.toBeVisible();
		await expect.element(word).toHaveAttribute('aria-invalid', 'true');
		await expect.element(word).toHaveFocus();
		expect(onSave).not.toHaveBeenCalled();
		expect(await axeViolations(dialog.element())).toEqual([]);

		await word.fill('Overage ');
		await setCap.click();
		await expect.poll(() => onSave.mock.calls.length).toBe(1);
		expect(onSave).toHaveBeenCalledWith(60);
		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		await expect.element(page.getByText('Cap saved: 60 calls a month.')).toBeVisible();
	});

	test('Keep cap at 40 closes without saving', async () => {
		const { keep, onSave, input } = await openAbove();
		await keep.click();
		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(onSave).not.toHaveBeenCalled();
		await expect.element(input).toHaveValue('60');
	});
});
