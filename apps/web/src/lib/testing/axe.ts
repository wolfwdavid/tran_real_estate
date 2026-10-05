import axe from 'axe-core';

// The WCAG tag set used by every axe run in this repo (E2E and component tests).
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Runs axe on a rendered fragment and returns `id: help` for each violation (empty = clean).
 * Component tests load no CSS, so colour contrast is NOT proven here; the Phase 2 token tests
 * and the E2E axe runs cover it.
 */
export async function axeViolations(root: Element): Promise<string[]> {
	const result = await axe.run(root, { runOnly: { type: 'tag', values: WCAG_TAGS } });
	return result.violations.map((v) => `${v.id}: ${v.help}`);
}
