// Constant, recorded CPU pressure for the Phase 15 evidence protocol (TEST-05). Cross-platform
// (stress-ng is Linux-only).
//
// Usage: node scripts/cpu-burn.mjs [--threads N] [--stop-file PATH] [--max-seconds S]
//   --threads N       burner threads (default: os.availableParallelism(), one per logical CPU)
//   --stop-file PATH  stop as soon as this file exists (checked every second)
//   --max-seconds S   hard stop (default 3600) so a forgotten burner never outlives the session
//
// Prints "cpu-burn: N threads on M CPUs, started <iso>" and "cpu-burn: stopped <iso> after <s> s"
// so the evidence file can quote both. SIGINT/SIGTERM take the same stop path. Burners run at
// normal priority on purpose: lowered priority is not real pressure.
import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { pathToFileURL } from 'node:url';
import { Worker, isMainThread, workerData } from 'node:worker_threads';

/**
 * @param {string[]} argv
 * @returns {{ threads: number; stopFile: string | null; maxSeconds: number }}
 */
export function parseArgs(argv) {
	const out = { threads: availableParallelism(), stopFile: null, maxSeconds: 3600 };
	for (let i = 0; i < argv.length; i++) {
		const flag = argv[i];
		const value = argv[i + 1];
		const positiveInt = () => {
			const n = Number(value);
			if (value === undefined || !Number.isInteger(n) || n <= 0) {
				throw new Error(`${flag} needs a positive integer, got ${JSON.stringify(value ?? null)}`);
			}
			i++;
			return n;
		};
		switch (flag) {
			case '--threads':
				out.threads = positiveInt();
				break;
			case '--max-seconds':
				out.maxSeconds = positiveInt();
				break;
			case '--stop-file':
				if (value === undefined || value.startsWith('--')) {
					throw new Error('--stop-file needs a path');
				}
				out.stopFile = value;
				i++;
				break;
			default:
				throw new Error(`unknown argument ${flag}`);
		}
	}
	return out;
}

// Worker branch: a pure-arithmetic busy loop; worker.terminate() interrupts it. The loop must not
// read the clock: on Windows V8's Date.now() takes a process-wide mutex, so 16 threads polling it
// serialise on that lock and burn about 2.8 cores between them instead of 16 (measured 2026-11-09).
// The accumulator is checked so the JIT cannot drop the loop body as dead code.
if (!isMainThread && workerData?.burn === true) {
	let acc = 0;
	for (;;) {
		for (let i = 0; i < 1_000_000; i++) acc = (acc * 31 + i) | 0;
		if (acc === 0x7fff_ffff) console.log('cpu-burn: accumulator hit the sentinel');
	}
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>} exit code
 */
async function main(argv) {
	let args;
	try {
		args = parseArgs(argv);
	} catch (e) {
		console.error(`cpu-burn: ${/** @type {Error} */ (e).message}`);
		return 2;
	}
	const started = Date.now();
	const workers = Array.from(
		{ length: args.threads },
		() => new Worker(new URL(import.meta.url), { workerData: { burn: true } })
	);
	console.log(
		`cpu-burn: ${args.threads} threads on ${availableParallelism()} CPUs, started ${new Date(started).toISOString()}`
	);
	await new Promise((resolve) => {
		const stop = () => {
			clearInterval(timer);
			process.off('SIGINT', stop);
			process.off('SIGTERM', stop);
			resolve(undefined);
		};
		const timer = setInterval(() => {
			const elapsedMs = Date.now() - started;
			if ((args.stopFile && existsSync(args.stopFile)) || elapsedMs >= args.maxSeconds * 1000)
				stop();
		}, 1000);
		process.on('SIGINT', stop);
		process.on('SIGTERM', stop);
	});
	await Promise.all(workers.map((w) => w.terminate()));
	const secs = (Date.now() - started) / 1000;
	console.log(`cpu-burn: stopped ${new Date().toISOString()} after ${secs.toFixed(1)} s`);
	return 0;
}

if (isMainThread && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exit(await main(process.argv.slice(2)));
}
