import { test, expect, type Page } from '@playwright/test';
import { AGENT_ROUTES } from './routes';
import {
	TEST_ACCESS_KEY,
	announcer,
	inquiryPath,
	loadSampleContacts,
	mockWeb3Forms,
	rentcastTripwire
} from './agent-helpers';

// Phase 8 gate (08-26, success criterion 5): one walk through every agent flow with the RentCast
// tripwire armed from the first request: every agent route empty, samples loaded, every route
// again, a pipeline move through the Move menu, a pasted TRAN-LEAD import, a keyless follow-up
// draft (Fixture provider) marked as sent, a profile save and an inquiry submit to a mocked
// Web3Forms. The tripwire must stay empty, and no visited page may offer an sms: link (no SMS
// feature, TCPA).

const ROUTES = ['agent/', ...AGENT_ROUTES] as const;
const CONTACT = 'Jordan Example';
const MOVED = 'Rowan Specimen';

const BLOCK = [
	'New inquiry for Sample Agent from Quinn Walk',
	'',
	'TRAN-LEAD v1',
	'name: Quinn Walk',
	'email: quinn.walk@example.com',
	'phone: (555) 555-0140',
	'property: 12 Sample Lane',
	'consent: yes',
	'submitted: 2026-10-06T10:00:00Z',
	'message: Is the two-bedroom still open?',
	'END TRAN-LEAD'
].join('\n');

// The second selector also catches SMS: and other casings (URL schemes are case-insensitive).
const smsLinks = (page: Page) => page.locator('a[href^="sms:"], a[href^="sms:" i]');

async function settle(page: Page) {
	await expect(page.locator('html')).not.toHaveAttribute('hidden');
	await expect(page.locator('h1:visible')).toHaveCount(1);
	await expect(page.getByText(/^Loading (your|this) /)).toHaveCount(0);
}

const visited: string[] = [];

/** Opens a page, waits for it to settle and checks it offers no sms: link. */
async function visit(page: Page, path: string) {
	await page.goto(path);
	await settle(page);
	await expectNoSms(page, path);
}

async function expectNoSms(page: Page, label: string) {
	visited.push(label);
	await expect(smsLinks(page), `sms: link on ${label}`).toHaveCount(0);
}

test('every agent flow makes zero RentCast requests and offers no sms: links', async ({ page }) => {
	// A long single-core walk (about 20 page loads plus a draft): triple the default timeout.
	test.slow();
	visited.length = 0;
	const hits = await rentcastTripwire(page);
	const posts = await mockWeb3Forms(page, 'ok');

	// 1. Every agent route with an empty CRM.
	for (const route of ROUTES) await visit(page, route);

	// 2. Samples loaded, then every route again (the contact detail with a real ?id=).
	await loadSampleContacts(page);
	await expectNoSms(page, 'contacts after loading samples');
	await visit(page, 'agent/contacts/');
	const href = await page
		.getByRole('link', { name: CONTACT, exact: true })
		.first()
		.getAttribute('href');
	const id = new URL(href ?? '', 'http://x/').searchParams.get('id');
	expect(id).toBeTruthy();
	for (const route of ROUTES) {
		await visit(page, route === 'agent/contact/' ? `${route}?id=${id}` : route);
	}

	// 3. A pipeline move through the Move menu.
	await visit(page, 'agent/pipeline/');
	await page.getByRole('button', { name: `Move ${MOVED}` }).click();
	await page.getByRole('menuitemradio', { name: 'Closed' }).click();
	await expect(announcer(page)).toHaveText(`Moved ${MOVED} to Closed.`);
	await expectNoSms(page, 'pipeline after a move');

	// 4. Import a pasted inquiry email and commit it.
	await visit(page, 'agent/import/');
	await page.locator('#paste').getByLabel('Lead email text').fill(BLOCK);
	await page.locator('#paste').getByRole('button', { name: 'Check pasted text' }).click();
	const review = page.getByTestId('import-review');
	await expect(review.getByText('New contact', { exact: true })).toBeVisible();
	await review.getByRole('button', { name: 'Add 1 leads' }).click();
	await expect(page.getByRole('heading', { level: 3, name: 'Import complete' })).toBeVisible();
	await expect(page.getByTestId('import-result')).toContainText('1 added, 0 updated, 0 skipped.');
	await expectNoSms(page, 'import result');

	// 5. Draft a follow-up on the contact page (keyless: Fixture provider) and mark it as sent.
	await visit(page, `agent/contact/?id=${id}`);
	await expect(page.getByRole('heading', { level: 1, name: CONTACT })).toBeVisible();
	await page.getByRole('button', { name: 'Draft follow-up email', exact: true }).click();
	const panel = page.getByRole('region', { name: 'Follow-up draft' });
	await expect(panel.getByText('Draft ready.', { exact: true })).toBeVisible({ timeout: 20_000 });
	const exits = panel.getByTestId('generation-exits');
	await expect(exits.getByRole('link', { name: 'Open in email app' })).toHaveAttribute(
		'href',
		/^mailto:/
	);
	await exits.getByRole('button', { name: 'Mark as sent' }).click();
	await expect(exits.getByRole('button', { name: 'Marked as sent' })).toBeVisible();
	await expectNoSms(page, 'contact after drafting');

	// 6. Save the agent profile.
	await visit(page, 'agent/profile/');
	const field = (label: string) => page.getByLabel(label, { exact: true });
	await field('Full name').fill('Sample Agent');
	await field('Brokerage').fill('Example Realty');
	await field('License type').selectOption('salesperson');
	await field('License number').fill('SAMPLE-0001');
	await field('License state').selectOption('TX');
	await field('Brokerage phone').fill('(555) 555-0100');
	await field('Street address').fill('12 Sample Lane');
	await field('City').fill('Austin');
	await field('State').selectOption('TX');
	await field('ZIP code').fill('78701');
	await page.getByRole('button', { name: 'Save profile' }).click();
	await expect(page.getByTestId('profile-status')).toHaveText('Saved.');
	await expectNoSms(page, 'profile after saving');

	// 7. Submit the public inquiry form to the mocked Web3Forms, past the 3-second gate.
	await page.clock.install();
	await visit(
		page,
		inquiryPath({ v: '1', k: TEST_ACCESS_KEY, n: 'Sample Agent', b: 'Example Realty' })
	);
	await page.getByLabel('Your name').fill('Jordan Walk');
	await page.getByLabel('Email').fill('jordan.walk@example.com');
	await page.getByLabel('Message').fill('Is the two-bedroom still available?');
	await page.getByLabel('I agree to be contacted about my inquiry.').check();
	await page.clock.fastForward(3500);
	await page.getByRole('button', { name: 'Send message' }).click();
	await expect(page.getByRole('heading', { level: 2, name: 'Message sent' })).toBeVisible();
	expect(posts).toHaveLength(1);
	await expectNoSms(page, 'inquiry after sending');

	// Non-vacuity: the walk covered every route twice plus each flow's end state.
	expect(visited.length).toBeGreaterThanOrEqual(ROUTES.length * 2 + 6);
	expect(hits, 'agent flows must never call RentCast').toEqual([]);
});
