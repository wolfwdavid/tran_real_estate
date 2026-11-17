import { defineConfig } from '@playwright/test';
import { ensureSystem32OnPath } from '../../scripts/lib/windows-path.mjs';

// Same environment as playwright.config.ts: report service worker requests too.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

// Windows: the guard puts the system directory on PATH first or teardown hangs silently.
ensureSystem32OnPath();

// Store screenshot capture, run on demand with `pnpm --filter extension capture:store`. The
// `.capture.ts` suffix keeps it out of the default `playwright test` run (testDir e2e, default
// testMatch), so `pnpm ext:e2e` never executes it.
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.capture.ts',
	workers: 1,
	retries: 0,
	reporter: 'list',
	// Timeout: same value as playwright.config.ts, which measured 3.6 s for the whole 7-test suite
	// including its one persistent-context launch (15-03 run 2026-11-09); 60 s keeps that margin for
	// the headless launch plus the headed relaunch fallback.
	timeout: 60_000
});
