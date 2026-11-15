import { configDefaults, defineConfig } from 'vitest/config';
import { files, MAX_WORKERS } from '../../tooling/vitest/lanes';

export default defineConfig({
	test: {
		name: 'core',
		// Vitest 5 gives every project its own maxWorkers default and rejects mixed values in one
		// group, so each parallel project pins the shared cap (tooling/vitest/lanes.ts).
		maxWorkers: MAX_WORKERS,
		environment: 'node',
		include: ['src/**/*.test.ts'],
		exclude: [...configDefaults.exclude, ...files('core')],
		setupFiles: ['../../tooling/vitest/no-network.ts']
	}
});
