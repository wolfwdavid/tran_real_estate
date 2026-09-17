import { expect, test } from 'vitest';
import { resolveBasePath, resolveBuildDir } from './base-path.js';

const MSYS_MANGLED = 'C:/Program Files/Git/tran_real_estate';
const ACTIONABLE = /BASE_PATH[\s\S]*MSYS_NO_PATHCONV/;

test('resolveBasePath returns "" when BASE_PATH is unset', () => {
	expect(resolveBasePath({})).toBe('');
});

test('resolveBasePath returns "" when BASE_PATH is the empty string', () => {
	expect(resolveBasePath({ BASE_PATH: '' })).toBe('');
});

test('resolveBasePath accepts a root-relative path', () => {
	expect(resolveBasePath({ BASE_PATH: '/tran_real_estate' })).toBe('/tran_real_estate');
});

test('resolveBasePath rejects the Git Bash MSYS-mangled Windows path', () => {
	expect(() => resolveBasePath({ BASE_PATH: MSYS_MANGLED })).toThrow(ACTIONABLE);
});

test('resolveBasePath rejects a path without a leading slash', () => {
	expect(() => resolveBasePath({ BASE_PATH: 'tran_real_estate' })).toThrow(ACTIONABLE);
});

test('resolveBasePath rejects a trailing slash', () => {
	expect(() => resolveBasePath({ BASE_PATH: '/tran_real_estate/' })).toThrow(ACTIONABLE);
});

test('resolveBasePath rejects an empty path segment', () => {
	expect(() => resolveBasePath({ BASE_PATH: '/a//b' })).toThrow(ACTIONABLE);
});

test('resolveBasePath error names both BASE_PATH and MSYS_NO_PATHCONV', () => {
	let message = '';
	try {
		resolveBasePath({ BASE_PATH: MSYS_MANGLED });
	} catch (error) {
		message = (error as Error).message;
	}
	expect(message).toContain('BASE_PATH');
	expect(message).toContain('MSYS_NO_PATHCONV');
	expect(message).toContain(MSYS_MANGLED);
});

test('resolveBuildDir defaults to "build"', () => {
	expect(resolveBuildDir({})).toBe('build');
});

test('resolveBuildDir honours BUILD_DIR', () => {
	expect(resolveBuildDir({ BUILD_DIR: 'build-sub' })).toBe('build-sub');
});
