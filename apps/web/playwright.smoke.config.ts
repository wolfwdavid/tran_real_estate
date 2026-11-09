import { defineConfig, devices } from '@playwright/test';
import { ensureSystem32OnPath } from '../../scripts/lib/windows-path.mjs';
import { parseSmokeEnv } from './tests/smoke/env.js';

// Windows: Playwright tears child processes down with taskkill via cmd.exe; the guard puts the
// system directory on PATH first or teardown hangs silently (scripts/lib/windows-path.mjs).
ensureSystem32OnPath();

// Fail closed: a missing or unsafe SMOKE_BASE_URL throws here, before any test is listed or run.
const smoke = parseSmokeEnv(process.env);

// Read-only smoke of a deployed (or emulated) GitHub Pages origin. Zero retries on purpose: a
// retry would hide exactly the CDN/deploy failures this suite exists to catch. The suite only
// targets an already-running origin; scripts/smoke.mjs starts the Pages emulator for local runs.
export default defineConfig({
	testDir: 'tests/smoke',
	testMatch: /\.smoke\.ts$/,
	retries: 0,
	failOnFlakyTests: true,
	forbidOnly: true,
	fullyParallel: true,
	workers: process.env.CI ? 2 : 4,
	globalTimeout: 300_000,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: {
		...devices['Desktop Chrome'],
		baseURL: smoke.baseUrl,
		trace: 'retain-on-failure',
		reducedMotion: 'reduce'
	}
});
