// DEBT-08 (D-05): the emulator matches the measured GitHub Pages dotfile behaviour; probe + mutation proof in 14-08-SUMMARY.md.
// serve-pages.mjs binds its listeners at import time, so it is never imported here: the test
// spawns it against a fixture web dir (SERVE_PAGES_WEB_DIR) on OS-assigned free ports and talks to
// it with node:http (fetch is disabled in the scripts project).
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Reply = { status: number; location: string | undefined; body: string };

let fixture = '';
let child: ChildProcessWithoutNullStreams | undefined;
const ports = { root: 0, sub: 0, configured: 0, attacker: 0 };

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const srv = createServer();
		srv.once('error', reject);
		srv.listen(0, '127.0.0.1', () => {
			const addr = srv.address();
			const port = typeof addr === 'object' && addr ? addr.port : 0;
			srv.close(() => resolve(port));
		});
	});
}

function request(port: number, pathname: string): Promise<Reply> {
	return new Promise((resolve, reject) => {
		get({ host: '127.0.0.1', port, path: pathname }, (res) => {
			let body = '';
			res.setEncoding('utf8');
			res.on('data', (chunk) => (body += chunk));
			res.on('end', () =>
				resolve({ status: res.statusCode ?? 0, location: res.headers.location, body })
			);
		}).on('error', reject);
	});
}

function writeBuild(dir: string) {
	mkdirSync(path.join(dir, 'sub'), { recursive: true });
	writeFileSync(path.join(dir, 'index.html'), 'fixture-index');
	writeFileSync(path.join(dir, '404.html'), 'fixture-404');
	writeFileSync(path.join(dir, '.nojekyll'), '');
	writeFileSync(path.join(dir, 'sub', 'index.html'), 'fixture-sub');
}

beforeAll(async () => {
	fixture = mkdtempSync(path.join(tmpdir(), 'serve-pages-'));
	for (const name of ['build', 'build-sub', 'build-configured'])
		writeBuild(path.join(fixture, name));
	ports.root = await freePort();
	ports.sub = await freePort();
	ports.configured = await freePort();
	ports.attacker = await freePort();

	const proc = spawn(process.execPath, [path.join(import.meta.dirname, 'serve-pages.mjs')], {
		env: {
			...process.env,
			// The root listener mounts at the root target's BASE_PATH; pin it to the site root.
			BASE_PATH: '',
			SERVE_PAGES_WEB_DIR: fixture,
			E2E_PORT_ROOT: String(ports.root),
			E2E_PORT_SUB: String(ports.sub),
			E2E_PORT_CONFIGURED: String(ports.configured),
			E2E_PORT_ATTACKER: String(ports.attacker),
			SERVE_PAGES_EXIT_ON_STDIN_END: '1'
		},
		stdio: ['pipe', 'pipe', 'pipe']
	});
	child = proc;
	await new Promise<void>((resolve, reject) => {
		let out = '';
		let err = '';
		const timer = setTimeout(
			() => reject(new Error(`serve-pages did not start in 10 s:\n${out}\n${err}`)),
			10_000
		);
		proc.stderr.on('data', (chunk) => (err += String(chunk)));
		proc.stdout.on('data', (chunk) => {
			out += String(chunk);
			if ((out.match(/serve-pages:/g) ?? []).length >= 4) {
				clearTimeout(timer);
				resolve();
			}
		});
		proc.once('exit', (code) => {
			clearTimeout(timer);
			reject(new Error(`serve-pages exited early (${code}):\n${out}\n${err}`));
		});
	});
});

afterAll(async () => {
	if (child && child.exitCode === null) {
		const exited = new Promise((resolve) => child?.once('exit', resolve));
		child.stdin.end();
		await exited;
	}
	if (fixture) rmSync(fixture, { recursive: true, force: true });
});

describe('serve-pages dotfile parity with the live origin (root listener, mount /)', () => {
	it('serves an existing dotfile (/.nojekyll) with 200', async () => {
		// live, curl 2026-11-05: HTTP/1.1 200 OK (Content-Length: 0)
		const r = await request(ports.root, '/.nojekyll');
		expect(r.status).toBe(200);
		expect(r.body).toBe('');
	});

	it('answers a missing dotfile (/.no-such-dotfile) with 404 and the site 404.html', async () => {
		// live, curl 2026-11-05: HTTP/1.1 404 Not Found
		const r = await request(ports.root, '/.no-such-dotfile');
		expect(r.status).toBe(404);
		expect(r.body).toBe('fixture-404');
	});

	it('answers a dot-directory path with a slash (/.well-known/) with 404', async () => {
		// live, curl 2026-11-05: HTTP/1.1 404 Not Found
		const r = await request(ports.root, '/.well-known/');
		expect(r.status).toBe(404);
		expect(r.body).toBe('fixture-404');
	});

	it('answers a dot-directory path without a slash (/.well-known) with 404, not a 301', async () => {
		// live, curl 2026-11-05: HTTP/1.1 404 Not Found
		const r = await request(ports.root, '/.well-known');
		expect(r.status).toBe(404);
		expect(r.location).toBeUndefined();
		expect(r.body).toBe('fixture-404');
	});

	it('control: an existing directory without a slash answers 301 to the slash form', async () => {
		const r = await request(ports.root, '/sub');
		expect(r.status).toBe(301);
		expect(r.location).toBe('/sub/');
	});

	it('control: an existing directory with a slash serves its index.html', async () => {
		const r = await request(ports.root, '/sub/');
		expect(r.status).toBe(200);
		expect(r.body).toBe('fixture-sub');
	});
});

describe('serve-pages dotfile parity under /tran_real_estate (sub listener)', () => {
	it('serves /tran_real_estate/.nojekyll with 200', async () => {
		// live, curl 2026-11-05: HTTP/1.1 200 OK
		const r = await request(ports.sub, '/tran_real_estate/.nojekyll');
		expect(r.status).toBe(200);
		expect(r.body).toBe('');
	});

	it('answers the missing dotfile and both dot-directory forms with 404', async () => {
		// live, curl 2026-11-05: HTTP/1.1 404 Not Found for all three
		for (const p of ['.no-such-dotfile', '.well-known/', '.well-known']) {
			const r = await request(ports.sub, `/tran_real_estate/${p}`);
			expect(r.status, p).toBe(404);
			expect(r.location, p).toBeUndefined();
			expect(r.body, p).toBe('fixture-404');
		}
	});

	it('control: /tran_real_estate/sub answers 301 to /tran_real_estate/sub/', async () => {
		const r = await request(ports.sub, '/tran_real_estate/sub');
		expect(r.status).toBe(301);
		expect(r.location).toBe('/tran_real_estate/sub/');
	});
});
