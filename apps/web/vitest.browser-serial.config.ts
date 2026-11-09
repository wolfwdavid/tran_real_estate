import { defineConfig } from 'vitest/config';
import { serialTest } from '../../tooling/vitest/lanes';
import base from './vitest.browser.config';

// web-browser-serial: load-sensitive component tests, one Chromium tab at a time, in its own group
// (SERIAL_GROUP_ORDER['web-browser']) after every node-serial file. See tooling/vitest/lanes.ts.
export default defineConfig({ ...base, test: { ...base.test, ...serialTest('web-browser') } });
