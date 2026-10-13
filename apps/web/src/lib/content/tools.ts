// Barrel for the free calculator copy: server code (og cards) and tests that want every tool.
// Client components must import the per-tool modules under ./tools/ instead (tool-page budget).

import type { ToolContent, ToolSlug } from './tools/shared';
import { affordability } from './tools/affordability';
import { capRate } from './tools/cap-rate';
import { cashOnCash } from './tools/cash-on-cash';
import { dscr } from './tools/dscr';

export * from './tools/shared';
export * from './tools/hub';
export { DEFAULT_OG, DEFAULT_OG_ALT, type OgCard } from './og';

export const TOOLS: Readonly<Record<ToolSlug, ToolContent>> = {
	affordability,
	'cap-rate': capRate,
	'cash-on-cash': cashOnCash,
	dscr
};
