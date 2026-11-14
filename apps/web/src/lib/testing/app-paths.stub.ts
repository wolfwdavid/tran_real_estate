// Test-only stand-in for $app/paths (Kit plugin is not loaded under Vitest).
export const base = '';
export const assets = '';
// Kit 3 resolve() takes the pathname without its leading slash and returns it rooted at base.
export function resolve(path: string): string {
	return `${base}/${path}`;
}
