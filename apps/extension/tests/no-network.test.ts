import { describe, expect, test } from 'vitest';

const DISABLED = /Network access is disabled/;

describe('extension test environment has no network', () => {
	test('fetch throws', () => {
		// eslint-disable-next-line no-restricted-syntax -- proving the ban, not using the network
		expect(() => fetch('x')).toThrow(DISABLED);
	});

	test('window.fetch throws', () => {
		// eslint-disable-next-line no-restricted-syntax -- proving the ban, not using the network
		expect(() => window.fetch('x')).toThrow(DISABLED);
	});

	test('XMLHttpRequest throws', () => {
		expect(() => new XMLHttpRequest()).toThrow(DISABLED);
	});

	test('WebSocket throws', () => {
		expect(() => new WebSocket('ws://x.test')).toThrow(DISABLED);
	});

	test('EventSource throws', () => {
		expect(() => new EventSource('x')).toThrow(DISABLED);
	});

	test('navigator.sendBeacon throws', () => {
		expect(() => navigator.sendBeacon('x')).toThrow(DISABLED);
	});
});
