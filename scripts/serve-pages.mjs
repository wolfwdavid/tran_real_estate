// GitHub Pages behaviour emulator for the local/CI E2E suite.
//
// Neither `vite preview` (307 redirects, SSR fallthrough for unknown paths) nor a plain static
// server reproduces what Pages does with a prerendered adapter-static build:
//   - a directory requested WITHOUT a trailing slash answers 301 to the slash form
//   - a directory WITH a trailing slash serves its index.html (200) or the site 404.html (404)
//   - an unknown path serves the site 404.html with status 404, never 200
//
// Three loopback listeners, all ports env-overridable (the Vite preview defaults are taken by
// another local project, so the defaults here sit 100 higher):
//   E2E_PORT_ROOT     (4273) serves apps/web/build     mounted at /
//   E2E_PORT_SUB      (4274) serves apps/web/build-sub mounted at /tran_real_estate
//   E2E_PORT_ATTACKER (4275) serves a page that frames the root origin three ways (framing spec)
//
// The root and sub listeners start only when their build directory exists. The attacker listener
// always starts and answers GET / with 200, which is why Playwright's readiness probe targets it.
// Dependency-free on purpose: only node: builtins.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const web = path.resolve(import.meta.dirname, '../apps/web');
const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.webmanifest': 'application/manifest+json',
	'.png': 'image/png'
};

function site(port, mount, dir) {
	const root = path.resolve(dir);
	const prefix = mount === '/' ? '' : mount;
	const send = (res, status, file) => {
		if (!fs.existsSync(file)) {
			res.writeHead(status);
			return res.end();
		}
		res.writeHead(status, {
			'content-type': types[path.extname(file)] ?? 'application/octet-stream'
		});
		fs.createReadStream(file).pipe(res);
	};
	const server = http.createServer((req, res) => {
		const url = new URL(req.url, 'http://x');
		const notFound = () => send(res, 404, path.join(root, '404.html'));
		if (prefix && !url.pathname.startsWith(prefix)) return notFound();
		let rel;
		try {
			rel = decodeURIComponent(url.pathname.slice(prefix.length));
		} catch {
			return notFound();
		}
		const target = path.join(root, rel || '/');
		if (!target.startsWith(root)) return notFound(); // path-traversal guard
		let stat;
		try {
			stat = fs.statSync(target);
		} catch {
			return notFound();
		}
		if (stat.isDirectory()) {
			if (!url.pathname.endsWith('/')) {
				res.writeHead(301, { location: url.pathname + '/' + url.search });
				return res.end();
			}
			const index = path.join(target, 'index.html');
			return fs.existsSync(index) ? send(res, 200, index) : notFound();
		}
		send(res, 200, target);
	});
	server.listen(port, '127.0.0.1', () =>
		console.log(`serve-pages: http://127.0.0.1:${port}${mount} -> ${dir}`)
	);
	return server;
}

const ROOT = Number(process.env.E2E_PORT_ROOT ?? 4273);
const SUB = Number(process.env.E2E_PORT_SUB ?? 4274);
const ATTACKER = Number(process.env.E2E_PORT_ATTACKER ?? 4275);

if (fs.existsSync(path.join(web, 'build'))) site(ROOT, '/', path.join(web, 'build'));
if (fs.existsSync(path.join(web, 'build-sub'))) {
	site(SUB, '/tran_real_estate', path.join(web, 'build-sub'));
}

// Attacker origin: a different port is a different origin, so these frames are cross-origin.
// The iframe ids are a contract with tests/e2e/framing.spec.ts.
http
	.createServer((_req, res) => {
		res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
		res.end(`<!doctype html><title>attacker</title><h2>attacker</h2>
<iframe id="plain" src="http://127.0.0.1:${ROOT}/"></iframe>
<iframe id="sandboxed" sandbox="allow-forms" src="http://127.0.0.1:${ROOT}/renter/"></iframe>
<iframe id="sandboxed-scripts" sandbox="allow-scripts allow-same-origin" src="http://127.0.0.1:${ROOT}/agent/"></iframe>`);
	})
	.listen(ATTACKER, '127.0.0.1', () =>
		console.log(`serve-pages: http://127.0.0.1:${ATTACKER}/ -> attacker page`)
	);

// Shutdown contract with Playwright's webServer. Playwright launches this file through a shell
// (cmd.exe on Windows) and, when the run ends, terminates that shell. On POSIX the signal reaches
// this process, so the handlers below make the exit immediate. On Windows no signal is delivered
// to the orphaned grandchild: it keeps the inherited stdout/stderr pipes open and Playwright waits
// well over two minutes for them to close, which looks like a hung test run. The parent's death
// does close our stdin, so when Playwright launches us (it sets SERVE_PAGES_EXIT_ON_STDIN_END in
// apps/web/playwright.config.ts) treat end-of-stdin as the shutdown signal. The behaviour is opt-in
// because a shell background job (`node scripts/serve-pages.mjs &`) inherits a closed stdin and
// would otherwise exit before serving a single request.
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
	process.on(signal, () => process.exit(0));
}
if (process.env.SERVE_PAGES_EXIT_ON_STDIN_END === '1') {
	for (const event of ['end', 'close', 'error']) {
		process.stdin.on(event, () => process.exit(0));
	}
	process.stdin.resume();
}
