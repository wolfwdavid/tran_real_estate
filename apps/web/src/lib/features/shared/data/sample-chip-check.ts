/**
 * Coverage helper for 04-UI-SPEC "Sample fixtures: visible-content rules": every card rendering
 * fixture rows (`[data-provenance="sample"]`) must contain a VISIBLE sample chip
 * (`[data-provenance-chip="sample"]` with at least one client rect). Returns the offending cards,
 * so Phase 6-9 tests can assert `findUnbadgedSampleCards(container)` is empty.
 */
export function findUnbadgedSampleCards(root: ParentNode): Element[] {
	return Array.from(root.querySelectorAll('[data-provenance="sample"]')).filter(
		(card) =>
			!Array.from(card.querySelectorAll('[data-provenance-chip="sample"]')).some(
				(chip) => chip.getClientRects().length > 0
			)
	);
}
