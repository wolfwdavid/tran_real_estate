import { defineConfig } from 'vitest/config';
import { serialTest } from '../../tooling/vitest/lanes';
import base from './vite.config';

// web-serial: Node tests with wall-clock budgets or annotated raised timeouts. See tooling/vitest/lanes.ts.
export default defineConfig({ ...base, test: { ...base.test, ...serialTest('web') } });
