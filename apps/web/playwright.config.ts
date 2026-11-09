import { defineConfig, devices } from '@playwright/test';
import { targetEnv } from '../../scripts/lib/build-targets.mjs';
import { ensureSystem32OnPath } from '../../scripts/lib/windows-path.mjs';

// Windows: Playwright tears child processes down with taskkill via cmd.exe; the guard puts the
// system directory on PATH first or teardown hangs silently (scripts/lib/windows-path.mjs).
ensureSystem32OnPath();

// Ports are env-overridable. The defaults sit 100 above the Vite preview defaults because those
// belong to another local project on the development machine (never reuse or kill its servers).
const ROOT = Number(process.env.E2E_PORT_ROOT ?? 4273);
const SUB = Number(process.env.E2E_PORT_SUB ?? 4274);
const ATTACKER = Number(process.env.E2E_PORT_ATTACKER ?? 4275);
const CONFIGURED = Number(process.env.E2E_PORT_CONFIGURED ?? 4276);
// The root project follows BASE_PATH (D-02): CI's root leg builds with the owner's base path, so
// it is served and tested there ('' when unset = the site root).
const ROOT_BASE = targetEnv('root').BASE_PATH;

export default defineConfig({
	testDir: 'tests/e2e',
	forbidOnly: !!process.env.CI,
	// Retry policy (TEST-03): CI retries once ONLY to classify a failure. With failOnFlakyTests a test
	// that fails and then passes on the retry is reported "flaky" and still fails the job (ci.yml also
	// passes --fail-on-flaky-tests), so a retry can never turn red into green. Locally retries are 0.
	// Never raise retries or add toPass loops to hide a flake: root-cause it (tasks/lessons.md).
	retries: process.env.CI ? 1 : 0,
	failOnFlakyTests: !!process.env.CI,
	// Known-good worker counts (TEST-04): CI ubuntu-24.04 has 4 vCPUs and ran green at 2 ("using 2
	// workers", run 42289609809); the 16-CPU dev machine is green at 4 and gave six 30 s timeouts at 8
	// (10-23). Pinned so the count no longer follows the machine's CPU count.
	workers: process.env.CI ? 2 : 4,
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
			E2E_PORT_CONFIGURED: String(CONFIGURED),
			// On Windows Playwright cannot signal the server it spawned through cmd.exe; the server
			// instead exits when its stdin closes, which happens the moment Playwright tears it down.
			SERVE_PAGES_EXIT_ON_STDIN_END: '1'
		},
		url: `http://127.0.0.1:${ATTACKER}/`,
		reuseExistingServer: false,
		timeout: 30_000
	},
	// Trailing-slash baseURLs so relative page.goto('renter/') resolves under both bases.
	// *.configured.spec.ts files run ONLY against the configured build (test owner settings: form
	// key, analytics host + website id, contact email); every other spec runs on root and sub.
	projects: [
		{
			name: 'root',
			use: { baseURL: `http://127.0.0.1:${ROOT}${ROOT_BASE}/` },
			testIgnore: /\.configured\.spec\.ts$/
		},
		{
			name: 'sub',
			use: { baseURL: `http://127.0.0.1:${SUB}/tran_real_estate/` },
			testIgnore: [/framing\.spec/, /\.configured\.spec\.ts$/]
		},
		{
			name: 'configured',
			use: { baseURL: `http://127.0.0.1:${CONFIGURED}/` },
			testMatch: /\.configured\.spec\.ts$/
		}
	]
});
