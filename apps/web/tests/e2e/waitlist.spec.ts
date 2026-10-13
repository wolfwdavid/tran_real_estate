import { test, expect } from '@playwright/test';
import { expectAxeClean } from './agent-helpers';
import { siteEnv } from './site-env';
import { mailtoHref } from '../../src/lib/components/forms/form-gate';

// GTM-02 waitlist on a build WITHOUT the owner's Web3Forms key (root locally, sub always): every
// audience page shows the honest coming-soon panel, renders no form fields and never contacts
// Web3Forms. The open state is covered by waitlist.configured.spec.ts.

const PAGES = [
	{ route: 'for-renters/', portalName: 'Renter' },
	{ route: 'for-investors/', portalName: 'Investor' },
	{ route: 'for-agents/', portalName: 'Agent' }
] as const;

test.beforeEach(() => {
	const env = siteEnv(test.info().project.name);
	test.skip(
		!!env.web3formsKey,
		'owner key configured on this build; open state covered by the configured project'
	);
});

for (const p of PAGES) {
	test(`waitlist on ${p.route} is a coming-soon panel with no fields`, async ({ page }) => {
		const env = siteEnv(test.info().project.name);
		const web3forms: string[] = [];
		page.on('request', (r) => {
			if (r.url().includes('api.web3forms.com')) web3forms.push(r.url());
		});

		await page.goto(p.route);
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		const section = page.locator('#waitlist');
		await expect(section).toHaveCount(1);
		await expect(section.locator('input')).toHaveCount(0);
		await expect(section.locator('form')).toHaveCount(0);
		await expect(section).toContainText("The waitlist isn't open yet");

		const mailto = section.locator('a[href^="mailto:"]');
		if (env.contactEmail === '') {
			await expect(mailto).toHaveCount(0);
			await expect(section).toContainText('Please check back later.');
		} else {
			await expect(mailto).toHaveAttribute(
				'href',
				mailtoHref(env.contactEmail, `Tran ${p.portalName} waitlist`)
			);
		}

		await page.waitForLoadState('networkidle');
		expect(web3forms).toEqual([]);
	});

	test(`axe: waitlist coming-soon state on ${p.route}`, async ({ page }) => {
		await page.goto(p.route);
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		await page.locator('#waitlist').scrollIntoViewIfNeeded();
		await expectAxeClean(page, `${p.route} waitlist coming soon`);
	});
}
