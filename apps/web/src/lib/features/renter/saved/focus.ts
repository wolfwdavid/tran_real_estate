// Moves focus to a saved-search row's heading (tabindex -1), e.g. from "Saved search" or
// "Manage in Saved searches". The heading id is `saved-search-{id}` (SavedSearchRow).
export function savedSearchHeadingId(id: string): string {
	return `saved-search-${id}`;
}

export function focusSavedSearch(id: string): void {
	const el = document.getElementById(savedSearchHeadingId(id));
	if (!el) return;
	el.scrollIntoView({ block: 'center' });
	el.focus();
}
