// Behavioural pin of the lane exclusions (Phase 16 plan 02, WR-05). Each parallel sibling config is
// imported and its resolved `test.exclude` must hold every `files(lane)` entry, and each serial
// config must resolve to its `<lane>-serial` project over exactly those files. The old pin was a
// substring check on the source, which a comment naming files('web') satisfied after the real
// exclusion was deleted. Lives in scripts-serial: importing apps/web/vite.config.ts loads the Svelte
// Kit, Tailwind and Svelte plugins, which is slow under load (tooling/vitest/lanes.ts).
import { describe, expect, test } from 'vitest';
import { files, SERIAL, type Lane as LaneName } from '../tooling/vitest/lanes';

/** The slice of a Vitest config these pins read. */
type LaneConfig = { test?: { name?: string; include?: string[]; exclude?: string[] } };
type ConfigModule = { default: LaneConfig };

const LANE_NAMES = Object.keys(SERIAL) as LaneName[];

// Literal specifiers, so the bundler resolves them; loaded lazily, one lane per test.
const SERIAL_CONFIGS: Record<LaneName, () => Promise<ConfigModule>> = {
	core: () => import('../packages/core/vitest.serial.config') as Promise<ConfigModule>,
	web: () => import('../apps/web/vitest.serial.config') as Promise<ConfigModule>,
	'web-browser': () => import('../apps/web/vitest.browser-serial.config') as Promise<ConfigModule>,
	scripts: () => import('./vitest.serial.config') as Promise<ConfigModule>
};
const PARALLEL_CONFIGS: Record<LaneName, () => Promise<ConfigModule>> = {
	core: () => import('../packages/core/vitest.config') as Promise<ConfigModule>,
	web: () => import('../apps/web/vite.config') as Promise<ConfigModule>,
	'web-browser': () => import('../apps/web/vitest.browser.config') as Promise<ConfigModule>,
	scripts: () => import('./vitest.config') as Promise<ConfigModule>
};

/** The parallel sibling's exclude list holds every serial file of `lane`. */
const excludesLane = (cfg: LaneConfig, lane: LaneName): boolean =>
	files(lane).every((f) => cfg.test?.exclude?.includes(f) === true);

describe('lane exclusions, behavioural', () => {
	test.each(LANE_NAMES)(
		'lane %s: the serial config resolves to <lane>-serial over files(lane)',
		async (lane) => {
			const serial = (await SERIAL_CONFIGS[lane]()).default;
			expect(serial.test?.name).toBe(`${lane}-serial`);
			expect(serial.test?.include).toEqual(files(lane));
		}
	);

	test.each(LANE_NAMES)(
		'lane %s: the parallel sibling excludes every files(lane) entry',
		async (lane) => {
			const parallel = (await PARALLEL_CONFIGS[lane]()).default;
			expect(excludesLane(parallel, lane), `parallel sibling must exclude files('${lane}')`).toBe(
				true
			);
		}
	);

	test('non-vacuity: the predicate fails when files(lane) is missing from exclude', async () => {
		const real = (await PARALLEL_CONFIGS.web()).default;
		expect(excludesLane(real, 'web')).toBe(true);
		const serialFiles = new Set<string>(files('web'));
		const stripped: LaneConfig = {
			...real,
			test: { ...real.test, exclude: (real.test?.exclude ?? []).filter((e) => !serialFiles.has(e)) }
		};
		expect(excludesLane(stripped, 'web')).toBe(false);
		expect(excludesLane({ test: { exclude: ['node_modules/**'] } }, 'core')).toBe(false);
		expect(excludesLane({}, 'scripts')).toBe(false);
	});
});
