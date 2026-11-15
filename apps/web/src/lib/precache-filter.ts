// cache.addAll() in the service worker is all-or-nothing, and the precache list included
// /.nojekyll, which GitHub Pages never serves. Keep every dotfile out of the precache.
export function isPrecacheable(path: string): boolean {
	return !/(^|[\\/])\./.test(path);
}

/** The surviving paths of a Kit manifest `assets` list; Kit 3 includes every file under static/, dotfiles too. */
export function precacheFiles<T extends { path: string }>(assets: T[]): T['path'][] {
	return assets.filter((e) => isPrecacheable(e.path)).map((e) => e.path);
}
