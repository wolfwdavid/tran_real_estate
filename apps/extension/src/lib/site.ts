// The Tran site URL (origin + base path), from PUBLIC_SITE_URL and BASE_PATH at build time
// (LIVE-08, D-04). wxt.config.ts and both extension Vitest configs define __TRAN_SITE_URL__ with
// the web app's resolveSiteUrl(), so a custom domain or a new base path is a variable change.
// Default: https://wolfwdavid.github.io (+ BASE_PATH).
declare const __TRAN_SITE_URL__: string;
export const TRAN_SITE_URL: string = __TRAN_SITE_URL__;
export const TRAN_ORIGIN: string = new URL(TRAN_SITE_URL).origin;
export const PRIVACY_URL = `${TRAN_SITE_URL}/legal/privacy/#browser-extension`;
