// cache.addAll() in the service worker is all-or-nothing, and the precache list included
// /.nojekyll, which GitHub Pages never serves. Keep every dotfile out of the precache.
export function isPrecacheable(path: string): boolean {
	return !/(^|[\\/])\./.test(path);
}
