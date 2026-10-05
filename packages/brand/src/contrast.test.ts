import { expect, test } from 'vitest';
import * as brand from './index';

test('contrast gate exists', () => {
	const { contrastPairs } = brand as unknown as { contrastPairs?: readonly unknown[] };
	expect(contrastPairs?.length ?? 0).toBeGreaterThanOrEqual(45);
});
