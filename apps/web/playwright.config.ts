import { defineConfig, devices } from '@playwright/test';

// Playwright's only way to stop a webServer on Windows is `taskkill /pid <pid> /T /F`, run through
// cmd.exe with the runner's PATH and with its output discarded. On a machine whose PATH omits
// %SystemRoot%\System32 the call fails silently, the server survives, and every run appears to
// hang for minutes at teardown. This module is evaluated inside the runner process, so prepending
// System32 here makes taskkill resolvable for that call without touching the machine.
if (process.platform === 'win32') {
	const system32 = `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32`;
	const entries = (process.env.PATH ?? '').split(';');
	if (!entries.some((e) => e.toLowerCase() === system32.toLowerCase())) {
		process.env.PATH = [system32, ...entries].join(';');
	}
}

// Ports are env-overridable. The defaults sit 100 above the Vite preview defaults because those
// belong to another local project on the development machine (never reuse or kill its servers).
const ROOT = Number(process.env.E2E_PORT_ROOT ?? 4273);
const SUB = Number(process.env.E2E_PORT_SUB ?? 4274);
const ATTACKER = Number(process.env.E2E_PORT_ATTACKER ?? 4275);

export default defineConfig({
	testDir: 'tests/e2e',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	// Reduced motion for every spec: app.css sets html { scroll-behavior: smooth } under
	// no-preference, which animates Playwright's scroll-into-view. Settings fills in late (RentCast
	// usage, data status), so a click could land while the page was still scrolling and hit nothing
	// (traces: "element is not stable" then "outside of the viewport", then a lost "Save key" /
	// "Import backup" click). With reduce, the scroll is instant and transitions are 0 ms.
	use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure', reducedMotion: 'reduce' },
	// ONE webServer entry: a multi-entry array stalled on readiness on Windows during research.
	// serve-pages.mjs starts the root/sub listeners only when their build directory exists, but
	// the attacker listener always starts and answers GET / with 200. CI builds one target per
	// matrix leg, so the readiness probe must target the attacker listener, never the root one.
	webServer: {
		command: 'node ../../scripts/serve-pages.mjs',
		env: {
			E2E_PORT_ROOT: String(ROOT),
			E2E_PORT_SUB: String(SUB),
			E2E_PORT_ATTACKER: String(ATTACKER),
			// On Windows Playwright cannot signal the server it spawned through cmd.exe; the server
			// instead exits when its stdin closes, which happens the moment Playwright tears it down.
			SERVE_PAGES_EXIT_ON_STDIN_END: '1'
		},
		url: `http://127.0.0.1:${ATTACKER}/`,
		reuseExistingServer: false,
		timeout: 30_000
	},
	// Trailing-slash baseURLs so relative page.goto('renter/') resolves under both bases.
	projects: [
		{ name: 'root', use: { baseURL: `http://127.0.0.1:${ROOT}/` } },
		{
			name: 'sub',
			use: { baseURL: `http://127.0.0.1:${SUB}/tran_real_estate/` },
			testIgnore: /framing\.spec/
		}
	]
});
