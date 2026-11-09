import { defineConfig } from '@playwright/test';
import { ensureSystem32OnPath } from '../../scripts/lib/windows-path.mjs';

// Report requests made by extension service workers too (the zero-network session test records
// every request in the persistent context, including ones from background.js).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

// Windows: Playwright tears child processes down with taskkill via cmd.exe; the guard puts the
// system directory on PATH first or teardown hangs silently (scripts/lib/windows-path.mjs).
ensureSystem32OnPath();

// Nothing is served: the spec routes the one synthetic page inside the browser context and aborts
// every other http(s) request, so the suite never reaches the real network.
export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	// Retry policy (TEST-03): CI retries once ONLY to classify a failure. With failOnFlakyTests a test
	// that fails and then passes on the retry is reported "flaky" and still fails the job (ci.yml also
	// passes --fail-on-flaky-tests), so a retry can never turn red into green. Locally retries are 0.
	// Never raise retries or add toPass loops to hide a flake: root-cause it (tasks/lessons.md).
	retries: process.env.CI ? 1 : 0,
	failOnFlakyTests: !!process.env.CI,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	// One worker: the single spec is a serial describe that shares one persistent Chromium context
	// (launched once in beforeAll with the unpacked extension) and one request log, so there is
	// nothing to parallelise and a second worker would only launch a second extension instance.
	workers: 1,
	// Timeout: measured 0.447 s for the slowest test (reveal is one click and does not navigate) at
	// 1 worker on 2026-11-09, 2 runs (whole 7-test suite 3.6 s and 2.4 s). The same value also bounds
	// each hook, and the beforeAll hook is the real spender.
	// Cause: beforeAll launches a persistent Chromium context with the unpacked MV3 extension and
	// waits up to 15 s for its service worker; off CI a missing worker triggers a second, headed
	// launch with another 15 s wait, which can pass Playwright's 30 s default. 60 s keeps a 134x
	// margin over the slowest test.
	timeout: 60_000,
	use: { trace: 'retain-on-failure' }
});
