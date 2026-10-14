// Query parameters for the onboarding exits (10-UI-SPEC "/setup/rentcast/", "Sample mode hand-off").
// Pure functions: no storage, no DOM, safe in prerender and in the landing's graph.
import type { OnboardingPortal } from './onboarding-state';

const PORTALS: readonly string[] = ['renter', 'investor', 'agent'];

/** `?portal=` on /setup/rentcast/ picks the finish destination. Unknown or missing: renter. */
export function parseSetupPortal(search: string): OnboardingPortal {
	const value = new URLSearchParams(search).get('portal');
	return value !== null && PORTALS.includes(value) ? (value as OnboardingPortal) : 'renter';
}

/**
 * Reads `?source=sample` and returns the same URL without it (other params and the hash kept).
 * The input URL is not changed.
 */
export function consumeSampleParam(url: URL): { sample: boolean; cleaned: string } {
	if (url.searchParams.get('source') !== 'sample') return { sample: false, cleaned: url.href };
	const next = new URL(url.href);
	next.searchParams.delete('source');
	return { sample: true, cleaned: next.href };
}
