// Every user-facing string in the extension lives here once, verbatim from the UI-SPEC
// Copywriting Contract. The manifest (wxt.config.ts) reads name/description from this file too.
export const COPY = Object.freeze({
	name: 'Sponsored Listing Filter — for Zillow',
	shortName: 'Sponsored Filter',
	description:
		'Dims sponsored listing cards in Zillow search results. Show any card with one click. Collects nothing, sends nothing.',
	actionTitle: 'Sponsored Listing Filter',
	popupTitle: 'Sponsored Listing Filter',
	popupSubtitle: 'for Zillow',
	purpose: 'Dims sponsored and promoted cards in Zillow search results. You can show any card.',
	switchLabel: 'Dim sponsored listings',
	switchOn: 'On',
	switchOff: 'Off',
	countOne: 'sponsored card dimmed on this page',
	countOther: 'sponsored cards dimmed on this page',
	zero: 'No sponsored cards found on this page yet. More may appear as you scroll.',
	off: 'Filter is off. Sponsored cards show normally.',
	notZillow: 'Open a Zillow search page to see how many sponsored cards are dimmed.',
	notRunning: "The filter isn't running in this tab yet. Reload the Zillow page to start it.",
	storageError: "Couldn't read your setting. Close this popup and open it again.",
	privacyHeading: 'Collects nothing, sends nothing.',
	privacyBody:
		'This extension makes no network requests. It only changes how cards look on zillow.com and stores one setting, on or off, in your browser.',
	notAffiliated: 'Not affiliated with or endorsed by Zillow Group.',
	privacyLink: 'Privacy details',
	privacyLinkHidden: ' (opens in a new tab)',
	pillDimmed: 'Sponsored — show',
	pillDimmedHidden: ' this listing (dimmed by Sponsored Listing Filter)',
	pillRevealed: 'Sponsored — dim',
	pillRevealedHidden: ' this listing again',
	badgeTitleOff: 'Sponsored Listing Filter: off'
});

export const badgeTitleCount = (n: number) => `Sponsored Listing Filter: ${n} dimmed on this page`;
