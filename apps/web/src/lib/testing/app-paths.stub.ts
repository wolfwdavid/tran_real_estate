// Test-only stand-in for $app/paths (Kit plugin is not loaded under Vitest).
export const base = '';
export const assets = '';
export function resolve(path: string): string {
	return path;
}
