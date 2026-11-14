// Test-only stand-in for $app/paths (Kit's plugin is not loaded under Vitest). Mirrors Kit 3's
// client resolve() and asset() for a base-free origin: `base` and `assets` no longer exist.

/** A leading slash is a route ID (groups are not part of the URL); anything else is a pathname. */
export function resolve(id: string): string {
	if (id[0] !== '/') return `/${id}`;
	return id.replace(/\/\([^/)]+\)/g, '') || '/';
}

/** A leading slash on the file is tolerated (Kit warns and strips it). */
export function asset(file: string): string {
	return `/${file.replace(/^\//, '')}`;
}
