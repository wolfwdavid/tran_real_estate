import { defineConfig } from 'vitest/config';
import { serialTest } from '../tooling/vitest/lanes';
import base from './vitest.config';

// scripts-serial: tests that spawn real git, gitleaks and ESLint processes. See tooling/vitest/lanes.ts.
export default defineConfig({
	...base,
	test: {
		...base.test,
		...serialTest('scripts'),
		// Timeout: measured 13.5 s (eslint-rules.test.ts) and 7.2 s (origin-parity.test.ts) in a full
		// parallel run on 2026-11-06 (16 CPUs), and 56 s worst case for precommit.test.ts under CPU
		// pressure (10-23); and 6.4 s (eslint-rules), 2.5 s (origin-parity), 2.2 s (precommit) in the
		// serial lane (2026-11-09, machine shared with two other executors). Cause: these tests spawn
		// git, gitleaks and ESLint, which load their configs and parsers cold on every call. 60 s covers
		// the precommit worst case.
		testTimeout: 60_000
	}
});
