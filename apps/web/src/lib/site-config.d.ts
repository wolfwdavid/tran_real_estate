// Types for site-config.js, so packages without allowJs (apps/extension, LIVE-08) can import the
// one origin validator at build time. Keep in step with the five exports of site-config.js.
export const DEFAULT_SITE_ORIGIN: string;
export function resolveSiteOrigin(env?: Record<string, string | undefined>): string;
export function resolveAnalytics(env?: Record<string, string | undefined>): {
	host: string;
	websiteId: string;
};
export function resolveWeb3formsKey(env?: Record<string, string | undefined>): string;
export function resolveContactEmail(env?: Record<string, string | undefined>): string;
