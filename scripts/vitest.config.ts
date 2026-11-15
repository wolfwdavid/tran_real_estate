import { defineConfig } from 'vitest/config';
import { files, MAX_WORKERS } from '../tooling/vitest/lanes';

export default defineConfig({
	test: {
		name: 'scripts',
		maxWorkers: MAX_WORKERS,
		environment: 'node',
		include: ['**/*.test.ts'],
		exclude: ['**/node_modules/**', ...files('scripts')],
		setupFiles: ['../tooling/vitest/no-network.ts']
	}
});
