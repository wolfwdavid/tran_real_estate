import { defineConfig } from 'vitest/config';
import { files } from '../tooling/vitest/lanes';

export default defineConfig({
	test: {
		name: 'scripts',
		environment: 'node',
		include: ['**/*.test.ts'],
		exclude: ['**/node_modules/**', ...files('scripts')],
		setupFiles: ['../tooling/vitest/no-network.ts']
	}
});
