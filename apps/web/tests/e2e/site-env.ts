import { targetEnv } from '../../../../scripts/lib/build-targets.mjs';
import {
	resolveAnalytics,
	resolveWeb3formsKey,
	resolveContactEmail
} from '../../src/lib/site-config.js';

export interface SiteEnv {
	analyticsHost: string;
	websiteId: string;
	web3formsKey: string;
	contactEmail: string;
	collector: string;
}

/**
 * Settings baked into the build a Playwright project serves: root = this process's env (CI passes
 * the owner's vars), sub = always blank, configured = fixed test values. Specs branch on this so
 * unset-state (coming-soon / no-op) and configured-state assertions never contradict each other.
 */
export function siteEnv(project: string): SiteEnv {
	const env = project === 'root' ? process.env : { ...process.env, ...targetEnv(project) };
	const a = resolveAnalytics(env);
	return {
		analyticsHost: a.host,
		websiteId: a.websiteId,
		web3formsKey: resolveWeb3formsKey(env),
		contactEmail: resolveContactEmail(env),
		collector: `http://127.0.0.1:${Number(process.env.E2E_PORT_ATTACKER ?? 4275)}`
	};
}
