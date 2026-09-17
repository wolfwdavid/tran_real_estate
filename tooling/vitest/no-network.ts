import { beforeEach } from 'vitest';

const blocked = (() => {
	throw new Error(
		'Network access is disabled in unit tests. Inject a fake fetch into the unit under test.'
	);
}) as unknown as typeof fetch;

globalThis.fetch = blocked;
beforeEach(() => {
	globalThis.fetch = blocked; // re-assert in case a test replaced it
});
