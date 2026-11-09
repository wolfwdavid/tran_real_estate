import { defineConfig } from 'vitest/config';
import { MAX_WORKERS } from './tooling/vitest/lanes';

// VITEST_MAX_WORKERS is applied after fileParallelism:false and would run the *-serial files
// concurrently (verified on Vitest 4.1.12). Fail closed instead of silently breaking the lane.
if (process.env.VITEST_MAX_WORKERS) {
	throw new Error(
		'VITEST_MAX_WORKERS overrides fileParallelism:false and breaks the *-serial lane (tooling/vitest/lanes.ts); unset it.'
	);
}

// Parallel lane: the first six projects (sequence.groupOrder 0). Serial lane: the four
// *serial.config.ts files, one file at a time, in later groups (SERIAL_GROUP_ORDER: node lanes 1,
// web-browser 2) so each group starts only after the previous one finishes. Serial projects MUST
// stay file-based: CLI --sequence.* flags drop groupOrder from inline project objects
// (15-RESEARCH.md Pitfall 1).
export default defineConfig({
	test: {
		maxWorkers: MAX_WORKERS,
		projects: [
			'apps/web',
			'packages/core',
			'packages/brand',
			'scripts',
			'apps/web/vitest.browser.config.ts',
			'apps/extension',
			'packages/core/vitest.serial.config.ts',
			'apps/web/vitest.serial.config.ts',
			'apps/web/vitest.browser-serial.config.ts',
			'scripts/vitest.serial.config.ts'
		]
	}
});
