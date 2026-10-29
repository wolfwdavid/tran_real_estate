// The Tran site origin, from PUBLIC_SITE_URL at build time (LIVE-08). wxt.config.ts and both
// extension Vitest configs define __TRAN_ORIGIN__ with the web app's resolveSiteOrigin(), so a
// custom domain is a variable change. Default: https://tranrealestate.github.io.
declare const __TRAN_ORIGIN__: string;
export const TRAN_ORIGIN: string = __TRAN_ORIGIN__;
export const PRIVACY_URL = `${TRAN_ORIGIN}/legal/privacy/#browser-extension`;
