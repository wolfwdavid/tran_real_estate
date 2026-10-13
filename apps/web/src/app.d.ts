declare global {
	/** Four-digit year injected by Vite `define` at build time (vite.config.ts). */
	const __BUILD_YEAR__: number;
	// Phase 10 owner settings (vite.config.ts define). Read them only through $lib/site.
	const __SITE_URL__: string;
	const __ANALYTICS_HOST__: string;
	const __ANALYTICS_WEBSITE_ID__: string;
	const __WEB3FORMS_KEY__: string;
	const __CONTACT_EMAIL__: string;
}
export {};
