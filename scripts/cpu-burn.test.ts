// scripts/cpu-burn.mjs: argument parsing and both stop paths (--max-seconds and the stop file). Lives
// in scripts-serial because every spawn is a deliberate one-thread CPU hog with a wall-clock stop.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { parseArgs } from './cpu-burn.mjs';

const CLI = join(import.meta.dirname, 'cpu-burn.mjs');
const STARTED = /^cpu-burn: 1 threads on \d+ CPUs, started \S+/m;
const STOPPED = /^cpu-burn: stopped \S+ after \d+(\.\d+)? s/m;

const tmp = mkdtempSync(join(tmpdir(), 'cpu-burn-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const run = (args: string[]) => {
	const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', timeout: 10_000 });
	if (r.error) throw r.error;
	return r;
};

describe('parseArgs', () => {
	test('defaults: every logical CPU, no stop file, one hour hard stop', () => {
		expect(parseArgs([])).toEqual({
			threads: availableParallelism(),
			stopFile: null,
			maxSeconds: 3600
		});
	});

	test('reads --threads, --stop-file and --max-seconds', () => {
		expect(parseArgs(['--threads', '4', '--stop-file', 'x/stop', '--max-seconds', '90'])).toEqual({
			threads: 4,
			stopFile: 'x/stop',
			maxSeconds: 90
		});
	});

	test.each([
		[['--threads', '0'], /--threads/],
		[['--threads', 'abc'], /--threads/],
		[['--threads'], /--threads/],
		[['--max-seconds', '-1'], /--max-seconds/],
		[['--stop-file'], /--stop-file/],
		[['--bogus'], /--bogus/]
	])('rejects %j naming the flag', (argv, flag) => {
		expect(() => parseArgs(argv)).toThrow(flag);
	});
});

describe('cpu-burn.mjs', () => {
	test('stops itself after --max-seconds and reports start and stop', () => {
		const r = run(['--threads', '1', '--max-seconds', '1']);
		expect(r.signal, r.stderr).toBeNull();
		expect(r.status, r.stderr).toBe(0);
		expect(r.stdout).toMatch(STARTED);
		expect(r.stdout).toMatch(STOPPED);
	});

	test('stops on the stop file long before --max-seconds', () => {
		const stop = join(tmp, 'stop');
		writeFileSync(stop, '');
		const r = run(['--threads', '1', '--stop-file', stop, '--max-seconds', '30']);
		expect(r.signal, 'killed by the 10 s spawn timeout').toBeNull();
		expect(r.status, r.stderr).toBe(0);
		expect(r.stdout).toMatch(STOPPED);
	});

	test('invalid arguments exit 2 with the message on stderr', () => {
		const r = run(['--threads', 'abc']);
		expect(r.status).toBe(2);
		expect(r.stderr).toMatch(/^cpu-burn: .*--threads/m);
		expect(r.stdout).toBe('');
	});
});
