import { beforeEach } from 'vitest';

// The shared tooling/vitest/no-network.ts only replaces globalThis.fetch. happy-dom ships real
// window.fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon implementations, so every
// network primitive is replaced with a thrower here and re-applied before each test.
const disabled = (api: string): Error =>
	new Error(`Network access is disabled in extension tests (${api}).`);

const thrower = (api: string) =>
	function blocked(): never {
		throw disabled(api);
	};

const throwingClass = (api: string) =>
	class Blocked {
		constructor() {
			throw disabled(api);
		}
	};

function apply(): void {
	const g = globalThis as Record<string, unknown>;
	const fetchThrower = thrower('fetch');
	g.fetch = fetchThrower;
	if (typeof window !== 'undefined') {
		(window as unknown as Record<string, unknown>).fetch = fetchThrower;
	}
	g.XMLHttpRequest = throwingClass('XMLHttpRequest');
	g.WebSocket = throwingClass('WebSocket');
	g.EventSource = throwingClass('EventSource');
	Object.defineProperty(navigator, 'sendBeacon', {
		configurable: true,
		value: thrower('sendBeacon')
	});
}

apply();
beforeEach(apply);
