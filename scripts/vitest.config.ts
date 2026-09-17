import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'scripts',
		environment: 'node',
		include: ['**/*.test.ts'],
		exclude: ['**/node_modules/**'],
		setupFiles: ['../tooling/vitest/no-network.ts'],
		testTimeout: 60_000
	}
});
