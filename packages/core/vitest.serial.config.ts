import { defineConfig } from 'vitest/config';
import { serialTest } from '../../tooling/vitest/lanes';
import base from './vitest.config';

// core-serial: wall-clock budgets (ReDoS scans, property-test timing). See tooling/vitest/lanes.ts.
export default defineConfig({ ...base, test: { ...base.test, ...serialTest('core') } });
