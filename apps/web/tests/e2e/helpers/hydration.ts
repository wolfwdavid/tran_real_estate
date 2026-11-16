// Shared E2E hydration gate. A plain module, not a spec.
import { expect, type Page } from '@playwright/test';

/**
 * Waits until the page is hydrated: the header's PortalSwitcher sets nav[data-hydrated] in onMount,
 * which runs after the whole tree has its handlers. Not covered: components loaded by a later
 * import(), and data readiness (live queries).
 *
 * Do NOT use it on header-less layouts: (print) print/* and (public) agent/inquire/ render no
 * SiteHeader, so the nav never appears and the wait hangs. Wait on a page-owned signal there (the h1
 * the page sets in onMount). Also not for scripts-blocked pages.
 */
export async function expectHydrated(page: Page): Promise<void> {
	// Not `html` losing `hidden`: frame-guard.js removes that at parse time, long before hydration.
	await expect(page.locator('nav[data-hydrated]')).toBeAttached();
}
