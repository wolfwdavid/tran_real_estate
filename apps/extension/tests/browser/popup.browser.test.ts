// The toolbar popup in real Chromium, one render per UI-SPEC Popup State Matrix state, with the
// real tokens.css + app.css laid out so axe's colour-contrast rule measures the shipped colours.
// States are injected through PopupDeps: a loaded extension cannot fake an active Zillow tab.
import '../../src/entrypoints/popup/tokens.css';
import '../../src/entrypoints/popup/app.css';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import App from '../../src/entrypoints/popup/App.svelte';
import { PRIVACY_URL } from '../../src/lib/site';
import { COPY } from '../../src/lib/copy';
import { COUNT_PUSH, type CountPush, type CountResponse } from '../../src/lib/messages';
import type { ActiveTab, PopupDeps } from '../../src/lib/popup-model';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const ZILLOW_TAB: ActiveTab = { id: 7, url: 'https://www.zillow.com/homes/for_rent/' };
const OTHER_TAB: ActiveTab = { id: 7, url: 'https://example.com/' };
const pending = <T>() => new Promise<T>(() => {});

interface Scenario {
	enabled?: boolean | 'reject' | 'pending';
	tab?: ActiveTab;
	response?: CountResponse | 'reject';
}

function fakeDeps(s: Scenario) {
	let pushListener: ((push: CountPush, sender: number | undefined) => void) | undefined;
	const deps = {
		readEnabled: vi.fn(() =>
			s.enabled === 'reject'
				? Promise.reject(new Error('storage unavailable'))
				: s.enabled === 'pending'
					? pending<boolean>()
					: Promise.resolve(s.enabled ?? true)
		),
		writeEnabled: vi.fn((value: boolean) => {
			if (s.enabled !== 'reject' && s.enabled !== 'pending') s.enabled = value;
			return Promise.resolve();
		}),
		activeTab: vi.fn(() => Promise.resolve(s.tab ?? ZILLOW_TAB)),
		sendToTab: vi.fn(() =>
			s.response === 'reject'
				? Promise.reject(new Error('Could not establish connection'))
				: Promise.resolve(
						s.response ?? { enabled: s.enabled !== false, count: s.enabled === false ? 0 : 3 }
					)
		),
		onCountPush: vi.fn((l: (push: CountPush, sender: number | undefined) => void) => {
			pushListener = l;
			return () => {
				pushListener = undefined;
			};
		})
	} satisfies PopupDeps;
	return { deps, push: (p: CountPush, sender: number | undefined) => pushListener?.(p, sender) };
}

type StateCase = {
	name: string;
	scenario: Scenario;
	/** Exact visible copy of the status region once settled; '' for the empty loading region. */
	text: string;
	numeral?: string;
	switchDisabled: boolean;
};

const STATES: StateCase[] = [
	{ name: 'loading', scenario: { enabled: 'pending' }, text: '', switchDisabled: true },
	{
		name: 'counting 3',
		scenario: { response: { enabled: true, count: 3 } },
		text: COPY.countOther,
		numeral: '3',
		switchDisabled: false
	},
	{
		name: 'counting 1',
		scenario: { response: { enabled: true, count: 1 } },
		text: COPY.countOne,
		numeral: '1',
		switchDisabled: false
	},
	{
		name: 'zero',
		scenario: { response: { enabled: true, count: 0 } },
		text: COPY.zero,
		switchDisabled: false
	},
	{ name: 'off', scenario: { enabled: false }, text: COPY.off, switchDisabled: false },
	{ name: 'not-zillow', scenario: { tab: OTHER_TAB }, text: COPY.notZillow, switchDisabled: false },
	{
		name: 'not-running',
		scenario: { response: 'reject' },
		text: COPY.notRunning,
		switchDisabled: false
	},
	{
		name: 'storage-error',
		scenario: { enabled: 'reject' },
		text: COPY.storageError,
		switchDisabled: true
	}
];

async function axeViolations(): Promise<string[]> {
	const result = await axe.run(document, { runOnly: { type: 'tag', values: WCAG } });
	return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}

const theSwitch = () => page.getByRole('switch', { name: 'Dim sponsored listings' });
const statusRegion = () => document.querySelector('[role="status"]') as HTMLElement;

/** Waits until the popup has rendered its settled state (loading has nothing to wait for). */
async function settle(c: StateCase): Promise<void> {
	if (c.text) await expect.element(page.getByText(c.text, { exact: true })).toBeVisible();
	else await expect.element(theSwitch()).toBeInTheDocument();
}

// The extension page document is <html lang="en"> with a <title> (index.html); the test runner's
// iframe document is not, so mirror those two attributes before axe checks document-level rules.
beforeEach(() => {
	document.documentElement.lang = 'en';
	document.title = 'Sponsored Listing Filter';
});

afterEach(() => {
	document.querySelectorAll('[data-planted]').forEach((n) => n.remove());
});

describe('popup states', () => {
	test.each(STATES)('$name renders its copy, both notices and passes axe', async (c) => {
		const { deps } = fakeDeps({ ...c.scenario });
		render(App, { deps });
		await settle(c);

		const region = statusRegion();
		expect(region.getAttribute('aria-live')).toBe('polite');
		if (c.numeral) {
			expect(region.querySelector('.numeral')?.textContent).toBe(c.numeral);
			expect(region.textContent?.replace(/\s+/g, ' ').trim()).toBe(`${c.numeral} ${c.text}`);
		} else {
			expect(region.textContent?.trim()).toBe(c.text);
		}

		await expect.element(page.getByText(COPY.privacyHeading, { exact: true })).toBeVisible();
		await expect
			.element(page.getByText('Not affiliated with or endorsed by Zillow Group.', { exact: true }))
			.toBeVisible();

		const link = page.getByRole('link', { name: /Privacy details/ });
		expect(PRIVACY_URL).toBe('https://wolfwdavid.github.io/legal/privacy/#browser-extension');
		await expect.element(link).toHaveAttribute('href', PRIVACY_URL);
		await expect.element(link).toHaveAccessibleName('Privacy details (opens in a new tab)');
		await expect.element(link).toHaveAttribute('target', '_blank');
		await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');

		if (c.switchDisabled) await expect.element(theSwitch()).toBeDisabled();
		else await expect.element(theSwitch()).toBeEnabled();

		expect(await axeViolations()).toEqual([]);
	});
});

describe('popup interaction', () => {
	test('switch shows On when enabled and Off after the user turns it off', async () => {
		const { deps } = fakeDeps({ response: { enabled: true, count: 3 } });
		render(App, { deps });
		await expect.element(theSwitch()).toBeChecked();
		await expect.element(page.getByText(COPY.switchOn, { exact: true })).toBeVisible();

		await userEvent.click(theSwitch());

		expect(deps.writeEnabled).toHaveBeenCalledWith(false);
		await expect.element(theSwitch()).not.toBeChecked();
		await expect.element(page.getByText(COPY.switchOff, { exact: true })).toBeVisible();
		await expect.element(page.getByText(COPY.off, { exact: true })).toBeVisible();
		expect(await axeViolations()).toEqual([]);
	});

	test('the state word is hidden while the setting is still loading', async () => {
		const { deps } = fakeDeps({ enabled: 'pending' });
		render(App, { deps });
		await expect.element(theSwitch()).toBeDisabled();
		expect(page.getByText(COPY.switchOn, { exact: true }).elements()).toHaveLength(0);
		expect(page.getByText(COPY.switchOff, { exact: true }).elements()).toHaveLength(0);
	});

	test('a live count push from the active tab updates the count; other tabs are ignored', async () => {
		const { deps, push } = fakeDeps({ response: { enabled: true, count: 3 } });
		render(App, { deps });
		await expect.element(page.getByText(COPY.countOther, { exact: true })).toBeVisible();

		push({ type: COUNT_PUSH, enabled: true, count: 9 }, 99);
		push({ type: COUNT_PUSH, enabled: true, count: 1 }, ZILLOW_TAB.id);

		await expect.element(page.getByText(COPY.countOne, { exact: true })).toBeVisible();
		expect(statusRegion().querySelector('.numeral')?.textContent).toBe('1');
	});

	test('the count push listener is removed when the popup unmounts', async () => {
		const remover = vi.fn();
		const { deps } = fakeDeps({});
		deps.onCountPush.mockImplementation(() => remover);
		const screen = render(App, { deps });
		await expect.element(theSwitch()).toBeEnabled();
		screen.unmount();
		expect(remover).toHaveBeenCalledOnce();
	});
});

describe('axe non-vacuity', () => {
	test('a planted unnamed button next to the popup is reported', async () => {
		const { deps } = fakeDeps({ response: { enabled: true, count: 3 } });
		render(App, { deps });
		await expect.element(page.getByText(COPY.countOther, { exact: true })).toBeVisible();

		const planted = document.createElement('button');
		planted.dataset.planted = '';
		document.body.append(planted);

		const violations = await axeViolations();
		expect(violations.length).toBeGreaterThanOrEqual(1);
		expect(violations.some((v) => v.startsWith('button-name'))).toBe(true);
	});
});
