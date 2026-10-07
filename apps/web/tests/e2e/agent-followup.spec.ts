import { test, expect, type Page } from '@playwright/test';
import {
	expectAxeClean,
	expectNoHorizontalScroll,
	loadSampleContacts,
	rentcastTripwire
} from './agent-helpers';

// AI follow-up email drafts (08-25, AGT-06) on the real built site, both bases, keyless: with no
// AI key the Phase 5 GenerationPanel uses the Fixture provider, so no AI host may be reached
// (every provider host is aborted and recorded, and the record must stay empty). The draft body
// is written by the "model"; the agent's footer (signature, mailing address, opt-out line,
// disclosure) is appended in the browser and rides along in all three exits. Opted-out contacts
// get no panel, a real contact with no profile is blocked with the missing items, and a contact
// without an email keeps Copy text but cannot use Open in email app.
//
// Sample contacts used: Jordan Example (inquiry-form consent), Riley Sample (unknown consent),
// Emerson Draft (opted out), Morgan Demo (no email). Sample contacts draft with the sample agent
// profile (Avery Sample) because a fresh browser has no profile saved.

// Built from its code point so this file stays ASCII (the formatter rewrites \u escapes).
const MIDDOT = String.fromCharCode(0xb7);
const SEP = ` ${MIDDOT} `;

const AI_HOSTS = [
	'https://api.anthropic.com/**',
	'https://api.openai.com/**',
	'https://generativelanguage.googleapis.com/**',
	'https://openrouter.ai/**'
];

const FOOTER_LABEL = 'Added to the end of every follow-up';
const OPT_OUT = 'Reply STOP or unsubscribe to stop receiving emails from me.';
const AD_LINE = 'This email is a solicitation for real estate services.';
const POSTAL = '12 Sample Lane, Harlow Springs, TX 75001';
const DISCLOSURE = `Sample Realty${SEP}Avery Sample, Real Estate Salesperson${SEP}Lic. #SAMPLE-0001 (TX)${SEP}(555) 555-0100`;
/** The sample profile footer for an inquiry-form contact, exactly as appended. */
const SAMPLE_FOOTER = [
	'Avery Sample',
	'Sample Realty',
	`(555) 555-0199${SEP}avery@example.com${SEP}https://example.com`,
	'',
	POSTAL,
	OPT_OUT,
	DISCLOSURE,
	'Texas Real Estate Commission Consumer Protection Notice: https://www.trec.texas.gov/forms/consumer-protection-notice'
].join('\n');
const SAMPLE_PROFILE_LINE = 'Using a sample agent profile for this sample contact.';
const NO_EMAIL_REASON = 'Add an email address for Morgan Demo to open this in your email app.';
const OPTED_OUT =
	"Emerson Draft asked not to get emails from you, so Tran won't draft follow-up emails to them. To change this, edit their details.";

const composer = (page: Page) => page.locator('[data-followup]');
const panel = (page: Page) => page.getByRole('region', { name: 'Follow-up draft' });
const draft = (page: Page) => panel(page).getByRole('group', { name: 'Draft', exact: true });
const exits = (page: Page) => panel(page).getByTestId('generation-exits');
const copyButton = (page: Page) => exits(page).getByRole('button', { name: 'Copy text' });
const emailLink = (page: Page) => exits(page).getByRole('link', { name: 'Open in email app' });
const markButton = (page: Page) => exits(page).getByRole('button', { name: /^Mark(ed)? as sent$/ });
const draftButton = (page: Page) =>
	page.getByRole('button', { name: 'Draft follow-up email', exact: true });
const footer = (page: Page) => panel(page).locator('p', { hasText: `${FOOTER_LABEL}:` });

async function expectHydrated(page: Page) {
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
}

/** Opens a contact from its pipeline card and waits for the follow-up section to settle. */
async function openContact(page: Page, name: string) {
	await page.goto('agent/pipeline/');
	await expectHydrated(page);
	await page.getByRole('link', { name, exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
	await expect(composer(page)).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
}

async function draftNow(page: Page) {
	await draftButton(page).click();
	await expect(panel(page).getByText('Draft ready.', { exact: true })).toBeVisible({
		timeout: 20_000
	});
}

/**
 * Adds a real (non-sample) lead through the Add a lead dialog, waiting for hydration first (the
 * shared helper can race it). Stays local so agent-helpers.ts is untouched.
 */
async function addRealLead(page: Page, name: string, email: string) {
	await page.goto('agent/contacts/');
	await expectHydrated(page);
	const open = page.getByRole('button', { name: 'Add a lead' }).first();
	await expect(open).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	await open.click();
	const dialog = page.getByRole('dialog', { name: 'Add a lead' });
	await expect(dialog).toBeVisible();
	await dialog.getByLabel('Name', { exact: true }).fill(name);
	await dialog.getByLabel('Email', { exact: true }).fill(email);
	await dialog.getByRole('button', { name: 'Add lead' }).click();
	await expect(dialog).toBeHidden();
}

let rentcastHits: string[];
let aiHits: string[];

test.beforeEach(async ({ page }) => {
	rentcastHits = await rentcastTripwire(page);
	aiHits = [];
	for (const host of AI_HOSTS) {
		await page.route(host, (route) => {
			aiHits.push(route.request().url());
			return route.abort();
		});
	}
	await loadSampleContacts(page);
});

test.afterEach(() => {
	expect(rentcastHits, 'agent pages must never call RentCast').toEqual([]);
	expect(aiHits, 'keyless drafting must never reach an AI provider').toEqual([]);
});

test('sample contact drafts with the sample profile footer', async ({ page }) => {
	await openContact(page, 'Jordan Example');
	await expect(composer(page)).toHaveAttribute('data-followup', 'ready');
	await expect(page.locator('[data-followup-sample-profile]')).toContainText(SAMPLE_PROFILE_LINE);
	await expect(page.locator('[data-followup-sample-profile] [data-sample-chip]')).toBeVisible();
	await expect(page.locator('[data-followup-sent-note]')).toContainText(
		"They aren't sent to your AI provider."
	);
	await expect(page.getByLabel('Purpose')).toHaveValue('new');
	await expect(page.getByLabel('Email subject')).toHaveValue('Thanks for reaching out');

	await draftNow(page);
	await expect(panel(page).getByText('Sample output', { exact: true }).first()).toBeVisible();
	await expect(draft(page)).toContainText('Hi Jordan,');
	await expect(draft(page)).not.toContainText('{client_first_name}');

	const f = footer(page);
	await expect(f).toContainText('Avery Sample');
	await expect(f).toContainText(POSTAL);
	await expect(f).toContainText(OPT_OUT);
	await expect(f).toContainText(DISCLOSURE);
	await expect(f).not.toContainText(AD_LINE);
	// The footer is local: it never appears in the "What will be sent" details.
	await expect(panel(page).locator('details')).not.toContainText(OPT_OUT);
});

test('purpose changes the subject until it is edited, and an empty subject blocks drafting', async ({
	page
}) => {
	await openContact(page, 'Jordan Example');
	await page.getByLabel('Purpose').selectOption('touring');
	await expect(page.getByLabel('Email subject')).toHaveValue('Following up on your tour');

	await page.getByLabel('Email subject').fill('');
	await draftButton(page).click();
	await expect(composer(page).getByText('Add a subject line.', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Email subject')).toBeFocused();
	await expect(page.getByLabel('Email subject')).toHaveAttribute('aria-invalid', 'true');
	await expect(draft(page)).toContainText('Your draft will appear here.');

	await page.getByLabel('Email subject').fill('About Saturday');
	await page.getByLabel('Purpose').selectOption('closed');
	await expect(page.getByLabel('Email subject')).toHaveValue('About Saturday');
});

test('all three exits carry the footer', async ({ page, context, browserName }) => {
	test.skip(browserName !== 'chromium', 'clipboard permissions can only be granted in Chromium');
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await openContact(page, 'Jordan Example');
	await draftNow(page);

	// Open in email app: the mailto body is draft + footer.
	const href = (await emailLink(page).getAttribute('href')) ?? '';
	expect(href.startsWith('mailto:jordan@example.com?')).toBe(true);
	const url = new URL(href);
	expect(url.searchParams.get('subject')).toBe('Thanks for reaching out');
	// RFC 6068: the mailto builder writes line breaks as CRLF.
	const rawBody = url.searchParams.get('body') ?? '';
	expect(rawBody).toContain('\r\n');
	const body = rawBody.replace(/\r\n/g, '\n');
	expect(body.startsWith('Hi Jordan,')).toBe(true);
	expect(body).toContain(OPT_OUT);
	expect(body).toContain(POSTAL);
	expect(body).toContain(DISCLOSURE);
	expect(body.endsWith(`\n\n${SAMPLE_FOOTER}`)).toBe(true);

	// Copy text: the clipboard ends with the footer text.
	await copyButton(page).click();
	await expect(panel(page).getByText('Copied to your clipboard.', { exact: true })).toBeVisible();
	// The OS clipboard may store line breaks as CRLF (Windows); compare normalized text.
	const clipRaw = await page.evaluate(() => navigator.clipboard.readText());
	const clip = clipRaw.replace(/\r\n/g, '\n');
	expect(clip.startsWith('Hi Jordan,')).toBe(true);
	expect(clip.endsWith(`\n\n${SAMPLE_FOOTER}`)).toBe(true);
	expect(clip).toBe(body);

	// Mark as sent: a local note, an activity entry and the last-contact date.
	await markButton(page).click();
	// Not anchored: the status line's text node follows an icon slot, so it starts with whitespace.
	await expect(
		panel(page).getByText(/Marked as sent on [A-Z][a-z]{2} \d{1,2}, \d{4}\./)
	).toBeVisible();
	await expect(markButton(page)).toHaveText('Marked as sent');
	await page.reload();
	await expectHydrated(page);
	await expect(page.locator('[data-activity-list]')).toContainText(
		'Follow-up email marked as sent'
	);
	await page.goto('agent/pipeline/');
	await expectHydrated(page);
	await expect(page.getByRole('article', { name: 'Jordan Example' })).toContainText(
		'Last contact today'
	);
});

test('unknown-consent contacts get the ad identification line', async ({ page }) => {
	await openContact(page, 'Riley Sample');
	await draftNow(page);
	await expect(draft(page)).toContainText('Hi Riley,');
	await expect(footer(page)).toContainText(OPT_OUT);
	await expect(footer(page)).toContainText(AD_LINE);
	const body = new URL((await emailLink(page).getAttribute('href')) ?? '').searchParams.get('body');
	expect(body).toContain(AD_LINE);
});

test('opted-out contacts get no panel', async ({ page }) => {
	await openContact(page, 'Emerson Draft');
	await expect(composer(page)).toHaveAttribute('data-followup', 'opted-out');
	await expect(page.locator('[data-followup-opted-out]')).toHaveText(OPTED_OUT);
	await expect(draftButton(page)).toHaveCount(0);
	await expect(panel(page)).toHaveCount(0);
});

test('no email gates only Open in email app', async ({ page }) => {
	await openContact(page, 'Morgan Demo');
	await draftNow(page);
	await expect(emailLink(page)).toHaveAttribute('aria-disabled', 'true');
	await expect(emailLink(page)).not.toHaveAttribute('href');
	await expect(panel(page).getByText(NO_EMAIL_REASON, { exact: true })).toBeVisible();
	await expect(copyButton(page)).not.toHaveAttribute('aria-disabled', 'true');
	await expect(markButton(page)).not.toHaveAttribute('aria-disabled', 'true');
});

test('real contact with an incomplete profile is blocked', async ({ page }) => {
	await addRealLead(page, 'Pat Real', 'pat.real@example.com');
	await openContact(page, 'Pat Real');
	await expect(composer(page)).toHaveAttribute('data-followup', 'profile-incomplete');
	const block = page.locator('[data-followup-prerequisite]');
	await expect(
		block.getByRole('heading', { name: 'Before drafting emails, finish your profile' })
	).toBeVisible();
	await expect(block).toContainText('Missing:');
	await expect(block).toContainText('mailing address');
	await expect(block.getByRole('link', { name: 'Finish your profile' })).toHaveAttribute(
		'href',
		/agent\/profile\/$/
	);
	await expect(draftButton(page)).toHaveCount(0);
});

test('no sms links and zero AI or RentCast requests', async ({ page }) => {
	await openContact(page, 'Jordan Example');
	await draftNow(page);
	await expect(page.locator('a[href^="sms:"]')).toHaveCount(0);
	expect(aiHits).toEqual([]);
	expect(rentcastHits).toEqual([]);
});

for (const width of [1280, 375]) {
	test(`axe clean at ${width}px in every follow-up state`, async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
		const check = async (label: string) => {
			await expectAxeClean(page, `${label} at ${width}px`);
			if (width === 375) await expectNoHorizontalScroll(page);
		};

		await addRealLead(page, 'Pat Real', 'pat.real@example.com');
		await openContact(page, 'Pat Real');
		await expect(page.locator('[data-followup-prerequisite]')).toBeVisible();
		await check('follow-up prerequisite');

		await openContact(page, 'Emerson Draft');
		await expect(page.locator('[data-followup-opted-out]')).toBeVisible();
		await check('opted-out follow-up');

		await openContact(page, 'Jordan Example');
		await expect(draftButton(page)).toBeVisible();
		await check('follow-up panel ready');

		await draftNow(page);
		await expect(footer(page)).toBeVisible();
		await check('follow-up draft with footer');
	});
}
