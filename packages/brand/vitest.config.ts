import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'brand',
		environment: 'node',
		include: ['src/**/*.test.ts'],
		setupFiles: ['../../tooling/vitest/no-network.ts']
	}
});
