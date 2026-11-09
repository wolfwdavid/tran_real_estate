import { configDefaults, defineConfig } from 'vitest/config';
import { files } from '../../tooling/vitest/lanes';

export default defineConfig({
	test: {
		name: 'core',
		environment: 'node',
		include: ['src/**/*.test.ts'],
		exclude: [...configDefaults.exclude, ...files('core')],
		setupFiles: ['../../tooling/vitest/no-network.ts']
	}
});
