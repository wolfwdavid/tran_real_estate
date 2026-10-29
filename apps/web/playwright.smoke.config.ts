import { defineConfig, devices } from '@playwright/test';
import { parseSmokeEnv } from './tests/smoke/env.js';

// Playwright's only way to stop a child process on Windows is `taskkill`, resolved through the
// runner's PATH. Prepending %SystemRoot%\System32 keeps a machine PATH that omits it from stalling
// teardown (playwright.config.ts has the full story; this block is copied from there verbatim).
if (process.platform === 'win32') {
	const system32 = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32`;
	const entries = (process.env.PATH ?? '').split(';');
	if (!entries.some((e) => e.toLowerCase() === system32.toLowerCase())) {
		process.env.PATH = [system32, ...entries].join(';');
	}
}

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
