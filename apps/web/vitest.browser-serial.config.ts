import { defineConfig } from 'vitest/config';
import { serialTest } from '../../tooling/vitest/lanes';
import base from './vitest.browser.config';

// web-browser-serial: load-sensitive component tests, one Chromium tab at a time. See tooling/vitest/lanes.ts.
export default defineConfig({ ...base, test: { ...base.test, ...serialTest('web-browser') } });
