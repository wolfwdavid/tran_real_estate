// The ONLY source file that names the Phase 10 build-time globals (vite.config.ts `define`, values
// validated in site-config.js). Everything else imports these constants.

/** Absolute site URL: validated origin + base path, e.g. https://tranrealestate.github.io (+ /tran_real_estate on the sub build). Use for canonical, og:*, JSON-LD url, sitemap, robots. NEVER build absolute URLs from $app/paths base (relative during prerender) or page.url. */
export const SITE_URL: string = __SITE_URL__;
export const SITE_ORIGIN: string = new URL(SITE_URL).origin;
export const SITE_BASE: string = new URL(SITE_URL).pathname.replace(/\/$/, '');
/** Umami settings: both '' when analytics is off. */
export const ANALYTICS = Object.freeze({
	host: __ANALYTICS_HOST__,
	websiteId: __ANALYTICS_WEBSITE_ID__
});
/** The site's own Web3Forms access key (public by design), '' when unset. */
export const WEB3FORMS_KEY: string = __WEB3FORMS_KEY__;
/** Public contact address, '' when unset. */
export const CONTACT_EMAIL: string = __CONTACT_EMAIL__;
