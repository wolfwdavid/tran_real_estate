import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, RENTER_TEST_OPTIONS, rentcastCalls } from './support/network';
import { mockRentCast, rentcastFixtures } from './support/rentcast-mocks';
import { withRentCastKey } from './support/seed';
import { AI_HOSTS, countRequests, fakeKey, routeAnthropic, routeGemini } from './helpers/ai-mocks';

// RENT-07 end to end on both bases (06-18): on a listing, the renter fills the outreach form and
// the Phase 5 GenerationPanel drafts the message. The draft passes the Fair Housing checker, and
// it leaves Tran only through the renter's own hands: Copy text, or a mailto: link that opens
// their email app (Mark as sent is a local note). A Must fix phrase gates those exits, Gemini
// asks before client details are sent, and Draft history is per listing.
//
// Network: the 06-09 harness denies every external request first; the Phase 5 AI mocks answer one
// provider host on top of it, so a real provider is never reached and an unexpected call fails
// the test at teardown.

test.use(RENTER_TEST_OPTIONS);
test.describe.configure({ timeout: 120_000 });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const LISTING_A = 'SAMPLE-74201-R017';
const LISTING_B = 'SAMPLE-70201-R025';
/** Not a fixture id: served only by the live mock below, with every email removed. */
const NO_EMAIL_ID = '74201-Outreach-Ln';

const OCCUPANTS_ERROR = 'Enter a number from 1 to 12, or leave it blank.';
const TOPICS_ERROR = 'Choose at least one topic, or type a question below.';
const NO_RECIPIENT =
	"RentCast didn't list an email for this contact, so your email app will open without a recipient. Add one there, or call the listing contact instead.";
const BLOCK_REASON = 'Fix the 1 phrase marked Must fix to copy or email this draft.';
const GEMINI_TITLE = 'Send client details to Gemini?';
const DONT_SEND = "Don't send to Gemini";
/** A planted provider answer with one Must fix phrase ("no kids", familial status). */
const PLANTED =
	'Hello,\n\nI am writing about your rental. We have no kids and one cat. What are the deposit and the lease terms?\n\nThank you,\n{your_name}';

const VAULT_SESSION_KEY = 'tran.vault.session.v1';
const AI_PROVIDER_PREF = 'tran.ai.provider';
const SAVED_KEYS = [fakeKey('anthropic'), fakeKey('gemini')];

type Row = Record<string, unknown>;

function fixtureRow(id: string): Row {
	const row = rentcastFixtures().rentals.find((r) => r.id === id);
	if (!row) throw new Error(`fixture ${id} missing`);
	return structuredClone(row) as Row;
}

const agentEmail = (row: Row) => (row.listingAgent as { email: string }).email;

async function expectNoViolations(page: Page, label: string) {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

/**
 * Seeds an AI key into the vault's session store (the same format 06-09's withRentCastKey uses)
 * and selects that provider in the AI prefs, before any page script runs. Fake keys only.
 */
async function withAiKey(page: Page, provider: 'anthropic' | 'gemini'): Promise<void> {
	await page.addInitScript(
		({ storeKey, prefKey, provider, key }) => {
			let store: Record<string, unknown> = {};
			try {
				const parsed: unknown = JSON.parse(sessionStorage.getItem(storeKey) ?? '{}');
				if (parsed && typeof parsed === 'object') store = parsed as Record<string, unknown>;
			} catch {
				store = {};
			}
			store[provider] = key;
			sessionStorage.setItem(storeKey, JSON.stringify(store));
			localStorage.setItem(prefKey, JSON.stringify(provider));
		},
		{ storeKey: VAULT_SESSION_KEY, prefKey: AI_PROVIDER_PREF, provider, key: fakeKey(provider) }
	);
}

async function openListing(page: Page, id: string) {
	await page.goto(`renter/listing/?id=${encodeURIComponent(id)}`);
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.getByText('Loading listing…')).toHaveCount(0);
}

const section = (page: Page) => page.locator('[data-outreach]');
const panel = (page: Page) => section(page).getByRole('region', { name: 'Your message' });
const draft = (page: Page) => panel(page).getByRole('group', { name: 'Draft', exact: true });
const exits = (page: Page) => panel(page).getByTestId('generation-exits');
const copyButton = (page: Page) => exits(page).getByRole('button', { name: 'Copy text' });
const emailLink = (page: Page) => exits(page).getByRole('link', { name: 'Open in email app' });
const markButton = (page: Page) => exits(page).getByRole('button', { name: /^Mark(ed)? as sent$/ });
const draftButton = (page: Page) =>
	panel(page).getByRole('button', { name: 'Draft message', exact: true });
const people = (page: Page) => section(page).getByLabel('How many people will live there');
const history = (page: Page) => section(page).getByRole('region', { name: 'Draft history' });

async function expectDraftReady(page: Page): Promise<void> {
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible({
		timeout: 20_000
	});
}

test.describe('renter outreach', () => {
	let urls: string[] = [];

	test.beforeEach(async ({ page }) => {
		urls = [];
		page.on('request', (r) => urls.push(r.url()));
	});

	// No key in any URL, in every flow below.
	test.afterEach(() => {
		for (const url of urls) {
			for (const key of SAVED_KEYS) expect(url).not.toContain(key);
			expect(url).not.toMatch(/[?&]key=/);
		}
	});

	test('keyless: the sample draft streams and leaves only through the three exits', async ({
		page,
		net
	}) => {
		const llm = Object.values(AI_HOSTS).map((host) => countRequests(page, new URL(host).host));
		const row = fixtureRow(LISTING_A);
		await openListing(page, LISTING_A);

		await expect(
			section(page).getByRole('heading', { level: 2, name: 'Message the listing contact' })
		).toBeVisible();
		await people(page).fill('3');
		await draftButton(page).click();
		await expectDraftReady(page);

		await expect(panel(page).getByText('Sample output', { exact: true }).first()).toBeVisible();
		await expect(draft(page)).toContainText('pet');
		await expect(draft(page)).toContainText('deposit');
		await expect(draft(page)).toContainText('lease');

		// Exactly three exits, in order, and nothing else in the group.
		await expect(exits(page).locator(':scope > *')).toHaveCount(3);
		await expect(exits(page).locator('button, a')).toHaveCount(3);
		await expect(copyButton(page)).toBeVisible();
		await expect(emailLink(page)).toBeVisible();
		await expect(markButton(page)).toHaveText('Mark as sent');

		const href = (await emailLink(page).getAttribute('href')) ?? '';
		expect(href.startsWith(`mailto:${agentEmail(row)}?`)).toBe(true);
		expect(href).toContain('subject=Question%20about%20');
		expect(href).toContain(encodeURIComponent(row.addressLine1 as string));
		expect(href).toContain('body=');

		// The only outbound paths are the renter's: no LLM host, no RentCast call.
		for (const counter of llm) expect(counter.count).toBe(0);
		expect(rentcastCalls(net)).toBe(0);
		await expectNoViolations(page, 'outreach with a sample draft');
	});

	test('validation: a bad people count or no topic shows field errors and generates nothing', async ({
		page
	}) => {
		await openListing(page, LISTING_A);

		await people(page).fill('13');
		await draftButton(page).click();
		await expect(section(page).getByText(OCCUPANTS_ERROR, { exact: true })).toBeVisible();
		await expect(people(page)).toBeFocused();
		await expect(people(page)).toHaveAttribute('aria-invalid', 'true');

		await people(page).fill('');
		for (const name of [
			'Availability and move-in timing',
			'Pet policy and pet fees',
			'Application fees and deposit',
			'Lease length and terms'
		]) {
			await section(page).getByRole('checkbox', { name }).uncheck();
		}
		await draftButton(page).click();
		await expect(section(page).getByText(TOPICS_ERROR, { exact: true })).toBeVisible();
		await expect(
			section(page).getByRole('checkbox', { name: 'Availability and move-in timing' })
		).toBeFocused();

		// No generation started: the run control kept its label and no draft or status appeared.
		await expect(draftButton(page)).toBeVisible();
		await expect(panel(page).getByText('Draft ready.', { exact: true })).toHaveCount(0);
		await expect(draft(page)).toContainText('Your draft will appear here.');
		await expectNoViolations(page, 'outreach with field errors');
	});

	test('a Must fix phrase in a live draft gates Copy and email until it is removed', async ({
		page
	}) => {
		await withAiKey(page, 'anthropic');
		const calls = await routeAnthropic(page, { stream: PLANTED });
		await openListing(page, LISTING_A);

		await people(page).fill('2');
		await draftButton(page).click();
		await expectDraftReady(page);
		expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(1);
		await expect(draft(page)).toContainText('no kids');

		await expect(panel(page).getByText(BLOCK_REASON, { exact: true })).toBeVisible();
		await expect(copyButton(page)).toHaveAttribute('aria-disabled', 'true');
		await expect(emailLink(page)).toHaveAttribute('aria-disabled', 'true');
		await expect(emailLink(page)).not.toHaveAttribute('href');

		// The inline finding: popover open, axe clean, then remove the phrase.
		const trigger = draft(page).getByRole('button', { name: /no kids/ });
		await trigger.click();
		const popover = page.getByRole('dialog');
		await expect(popover).toBeVisible();
		await expect(popover.getByText('Must fix', { exact: true })).toBeVisible();
		await expectNoViolations(page, 'outreach finding popover');
		await popover.getByRole('button', { name: /^(Use alternative|Remove phrase)$/ }).click();
		await expect(popover).toBeHidden();
		await expect(draft(page)).not.toContainText('no kids');

		await expect(panel(page).getByText(BLOCK_REASON, { exact: true })).toHaveCount(0);
		await expect(copyButton(page)).not.toHaveAttribute('aria-disabled', 'true');
		await expect(emailLink(page)).not.toHaveAttribute('aria-disabled', 'true');
		await expect(emailLink(page)).toHaveAttribute('href', /^mailto:/);
		// The one generation is the only provider request.
		expect(calls.filter((c) => c.kind === 'generate')).toHaveLength(1);
	});

	test("Gemini asks before sending client details; Don't send to Gemini sends nothing", async ({
		page
	}) => {
		await withAiKey(page, 'gemini');
		const gemini = countRequests(page, 'generativelanguage.googleapis.com');
		await routeGemini(page, { stream: 'Hello from Gemini.' });
		await openListing(page, LISTING_A);

		await draftButton(page).click();
		const dialog = page.getByRole('alertdialog', { name: GEMINI_TITLE });
		await expect(dialog).toBeVisible();
		await expect(page.getByRole('button', { name: DONT_SEND })).toBeFocused();
		await expectNoViolations(page, 'outreach Gemini dialog');
		await page.getByRole('button', { name: DONT_SEND }).click();
		await expect(dialog).toBeHidden();
		await expect(
			panel(page).getByText('Canceled. Nothing was sent to Google.', { exact: true })
		).toBeVisible();
		expect(gemini.count).toBe(0);
	});

	test('live listing without an email: the note shows and the mailto has no recipient', async ({
		page,
		net
	}) => {
		const row = fixtureRow(LISTING_A);
		row.id = NO_EMAIL_ID;
		row.listingAgent = { ...(row.listingAgent as Row), email: null };
		row.listingOffice = { ...(row.listingOffice as Row), email: null };
		await withRentCastKey(page);
		await mockRentCast(page, net, { extraRows: [row] });
		await openListing(page, NO_EMAIL_ID);
		await page.getByRole('button', { name: 'Look it up again (1 call)' }).click();
		await expect(section(page)).toBeVisible();
		expect(rentcastCalls(net)).toBe(1);

		await expect(section(page).getByText(NO_RECIPIENT, { exact: true })).toBeVisible();
		await draftButton(page).click();
		await expectDraftReady(page);
		const href = (await emailLink(page).getAttribute('href')) ?? '';
		expect(href.startsWith('mailto:?subject=Question%20about%20')).toBe(true);
		expect(rentcastCalls(net)).toBe(1);
	});

	test("Draft history is per listing: listing B does not list listing A's draft", async ({
		page
	}) => {
		await openListing(page, LISTING_A);
		await draftButton(page).click();
		await expectDraftReady(page);
		await expect(history(page).getByText('1 saved in this browser', { exact: true })).toBeVisible();

		await openListing(page, LISTING_B);
		await expect(history(page).getByText('0 saved in this browser', { exact: true })).toBeVisible();
		await expect(history(page).getByRole('listitem')).toHaveCount(0);

		await openListing(page, LISTING_A);
		await expect(history(page).getByText('1 saved in this browser', { exact: true })).toBeVisible();
	});
});
