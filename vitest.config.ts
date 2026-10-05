import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: { projects: ['apps/web', 'packages/core', 'packages/brand', 'scripts'] }
});
