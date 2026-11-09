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
		// pressure (10-23). Cause: these tests spawn git, gitleaks and ESLint, which load their configs
		// and parsers cold on every call. 60 s covers the precommit worst case; Task 3 re-measures.
		testTimeout: 60_000
	}
});
