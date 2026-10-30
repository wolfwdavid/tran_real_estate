import { test, expect } from '@playwright/test';
import { targetEnv } from '../../../../scripts/lib/build-targets.mjs';
import { resolveSiteOrigin } from '../../src/lib/site-config.js';

// Privacy "Deleting your data" copy (plan 13-07, owner decision C). The live site is a project
// site under /tran_real_estate on an origin shared with the owner's other project sites, so the
// page must stop telling visitors to wipe "this site's data" (that wipes every sibling site too)
// and must say so, but only on a sub-path build: a future custom domain drops the paragraph.
// Every goto is relative so the same spec runs on root (with or without BASE_PATH) and sub.

/**
 * The site origin baked into the build a project serves, by the same rule as site-env.ts: root is
 * this process's env (CI passes the owner's vars), the other targets overlay targetEnv(project).
 */
function builtSiteHost(project: string): string {
	const env = project === 'root' ? process.env : { ...process.env, ...targetEnv(project) };
	return new URL(resolveSiteOrigin(env)).host;
}

test('deletion copy points to Forget all keys, not to wiping the whole site', async ({ page }) => {
	await page.goto('legal/privacy/');
	const main = page.locator('main');
	// innerText collapses the Prettier line wrap in the source into single spaces.
	await expect(main).toContainText('open Settings and choose Forget all keys.');
	await expect(main).toContainText(
		'Saved searches, deals, contacts and drafts can be deleted where you saved them'
	);
	await expect(main).not.toContainText("clear this site's data");
	await expect(main).not.toContainText('arrives with Settings');
});

test('the shared-origin paragraph renders only under a sub-path and names the built host', async ({
	page
}, testInfo) => {
	const baseURL = testInfo.project.use.baseURL;
	expect(baseURL, 'project baseURL').toBeTruthy();
	const underSubPath = new URL(baseURL!).pathname !== '/';

	await page.goto('legal/privacy/');
	const shared = page.locator('[data-shared-origin]');
	if (underSubPath) {
		const host = builtSiteHost(testInfo.project.name);
		expect(host, 'expected site host').not.toBe('');
		await expect(shared).toBeVisible();
		await expect(shared).toContainText(`other sites hosted at ${host}.`);
		await expect(shared).toContainText(
			'Keys stay session-only unless you choose to remember them.'
		);
		// The paragraph sits inside the deletion section, right after the always-on paragraph.
		await expect(shared).toHaveCount(1);
	} else {
		await expect(shared).toHaveCount(0);
		await expect(page.locator('main')).not.toContainText('shares its browser storage area');
	}
});
