import { defineConfig } from 'vitest/config';
import { MAX_WORKERS } from '../../tooling/vitest/lanes';

export default defineConfig({
	test: {
		name: 'brand',
		maxWorkers: MAX_WORKERS,
		environment: 'node',
		include: ['src/**/*.test.ts'],
		setupFiles: ['../../tooling/vitest/no-network.ts']
	}
});
