// Types for windows-path.mjs, so consumers checked without allowJs (apps/extension's wxt-generated
// tsconfig) see the real signature instead of an implicit any. Keep in step with windows-path.mjs.
export function ensureSystem32OnPath(
	env?: Record<string, string | undefined>,
	platform?: NodeJS.Platform
): boolean;
