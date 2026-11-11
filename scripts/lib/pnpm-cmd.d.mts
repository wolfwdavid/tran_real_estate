// Types for pnpm-cmd.mjs, so consumers checked without allowJs see the real signatures.
// Keep in step with pnpm-cmd.mjs.
export function pnpmCommand(
	env?: Record<string, string | undefined>,
	platform?: NodeJS.Platform
): { bin: string; pre: string[]; shell: boolean };
export function pinnedPnpmVersion(readText?: () => string): string;
