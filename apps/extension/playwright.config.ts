import { defineConfig } from '@playwright/test';

// Report requests made by extension service workers too (the zero-network session test records
// every request in the persistent context, including ones from background.js).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

// Playwright's only way to stop a child process on Windows is `taskkill /pid <pid> /T /F`, run
// through cmd.exe with the runner's PATH and with its output discarded. On a machine whose PATH
// omits %SystemRoot%\System32 the call fails silently and every run appears to hang for minutes at
// teardown. This module is evaluated inside the runner process, so prepending System32 here makes
// taskkill resolvable for that call without touching the machine.
if (process.platform === 'win32') {
	const system32 = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32`;
	const entries = (process.env.PATH ?? '').split(';');
	if (!entries.some((e) => e.toLowerCase() === system32.toLowerCase())) {
		process.env.PATH = [system32, ...entries].join(';');
	}
}

// Nothing is served: the spec routes the one synthetic page inside the browser context and aborts
// every other http(s) request, so the suite never reaches the real network.
export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	workers: 1,
	timeout: 60_000,
	use: { trace: 'retain-on-failure' }
});
