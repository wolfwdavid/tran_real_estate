import { describe, expect, test } from 'vitest';
import { resolveBuildStamp } from './build-stamp.js';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = '0123456789abcdef0123456789abcdef01234567';

const neverRead = () => {
	throw new Error('readHead must not be called');
};

describe('resolveBuildStamp precedence', () => {
	test('BUILD_SHA wins and git is never read', () => {
		expect(resolveBuildStamp({ BUILD_SHA: A }, neverRead)).toBe(A);
	});

	test('GITHUB_SHA is used when BUILD_SHA is unset', () => {
		expect(resolveBuildStamp({ GITHUB_SHA: B }, neverRead)).toBe(B);
	});

	test('BUILD_SHA beats GITHUB_SHA', () => {
		expect(resolveBuildStamp({ BUILD_SHA: A, GITHUB_SHA: B }, neverRead)).toBe(A);
	});

	test('empty values mean unset and fall back to git HEAD', () => {
		expect(resolveBuildStamp({ BUILD_SHA: '', GITHUB_SHA: '' }, () => C)).toBe(C);
		expect(resolveBuildStamp({}, () => C)).toBe(C);
	});
});

describe('resolveBuildStamp rejects anything but a 40-hex commit SHA', () => {
	const bad: Array<[string, Record<string, string>, () => string]> = [
		['a short SHA', { BUILD_SHA: 'abc1234' }, neverRead],
		['an upper-case SHA', { BUILD_SHA: A.toUpperCase() }, neverRead],
		['a SHA with leading whitespace', { GITHUB_SHA: ' ' + A }, neverRead],
		['an empty git HEAD (no checkout)', {}, () => ''],
		['a build timestamp', { BUILD_SHA: '1792988474126' }, neverRead]
	];
	for (const [name, env, readHead] of bad) {
		test(name, () => {
			expect(() => resolveBuildStamp(env, readHead)).toThrow(/40-hex commit SHA/);
		});
	}
});
