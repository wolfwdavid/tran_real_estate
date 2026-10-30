// The Tran site URL (origin + base path), from PUBLIC_SITE_URL and BASE_PATH at build time
// (LIVE-08, D-04). wxt.config.ts and both extension Vitest configs define __TRAN_SITE_URL__ with
// the web app's resolveSiteUrl(), so a custom domain or a new base path is a variable change.
// Default: https://wolfwdavid.github.io (+ BASE_PATH).
//
// The site URL must only ever appear in the bundle inside a path under it (PRIVACY_URL): the
// manifest/zero-network oracle (scripts/assert-extension.mjs) allowlists `${siteUrl}/` as a prefix
// so a lookalike host or a sibling project site on the shared origin is rejected, and a bare
// `${siteUrl}` literal fails it too. With one use, the bundler folds the define into the privacy
// link; a second use (e.g. `new URL(TRAN_SITE_URL)`) keeps the bare literal and fails `ext:assert`.
declare const __TRAN_SITE_URL__: string;
export const TRAN_SITE_URL: string = __TRAN_SITE_URL__;
export const PRIVACY_URL = `${TRAN_SITE_URL}/legal/privacy/#browser-extension`;
