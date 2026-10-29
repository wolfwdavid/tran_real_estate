// Types for assert-csp.mjs, so typed consumers (the smoke fixtures under apps/web, checked by
// svelte-check with checkJs) can import the oracle's CONNECT list without type-checking the whole
// untyped oracle. Keep in step with the exports of assert-csp.mjs.
export const CONNECT: string[];
export const EXACT: Record<string, string[]>;
export const EXPECTED_PAGES: string[];
export const CARRIERS: string[];
export function checkHtml(
	relPath: string,
	html: string,
	opts?: { analyticsHost?: string }
): string[];
export function checkAssetText(relPath: string, text: string): string[];
export function checkManifest(text: string): string[];
export function checkBuild(dir: string, opts?: { analyticsHost?: string }): string[];
export function countPages(dir: string): number;
