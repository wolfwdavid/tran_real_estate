// Onboarding copy (UI-SPEC "Landing: hero change and Get started guide", "/setup/rentcast/",
// "Settings: Getting started", "Live-region announcements"). Verbatim; every string lives once,
// here or in ./onboarding-guide (the landing-initial subset, re-exported below).
// Marketing-safe: imports only its sibling content module.
import { GUIDE_INTRO_COPY } from './onboarding-guide';

export { GUIDE_INTRO_COPY };

export type OnboardingPortalName = 'renter' | 'investor' | 'agent';

export interface TourStep {
	title: string;
	body?: string;
	list?: string[];
}

const SAMPLE_OR_LIVE: TourStep = {
	title: 'Sample data or live data',
	body: "Sample data is made up, uses no calls, and needs no key. It's the quickest way to look around. Live data comes from RentCast with your own free key, which includes 50 calls a month. Tran stops at a cap you set, 40 to start, and asks before each extra call."
};

/** Full guide copy: the landing-initial strings plus the tour controls (loaded with the tour). */
export const GUIDE_COPY = {
	...GUIDE_INTRO_COPY,
	buttons: {
		changePortal: 'Change portal',
		back: 'Back',
		next: 'Next',
		skip: 'Skip tour',
		sample: 'Try sample data',
		key: 'Connect a free RentCast key',
		empty: 'Start with an empty pipeline'
	},
	tourHeader: { renter: 'Renter tour', investor: 'Investor tour', agent: 'Agent tour' },
	progress: (n: number) => `Step ${n} of 3`,
	step3Helper: 'You can switch between sample and live data any time in Settings.'
} as const;

/** Three steps per portal; renter and investor share step 3. */
export const TOURS = {
	renter: [
		{
			title: 'What the renter portal does',
			list: [
				'Search rentals in any US city or ZIP code.',
				"Save a search and see what's new each time you come back.",
				'Compare an asking rent with the local market, then draft an inquiry you send yourself.'
			]
		},
		{
			title: 'Where your keys go',
			body: 'Real listings need a free RentCast key. An AI key from Anthropic, OpenAI, Google, or OpenRouter is optional, for drafting inquiries. Each key goes straight from your browser to the service it belongs to. Tran has no server and never receives it. Keys are kept for this tab only, unless you choose to remember them.'
		},
		SAMPLE_OR_LIVE
	],
	investor: [
		{
			title: 'What the investor portal does',
			list: [
				'Analyze a deal: NOI, cap rate, cash-on-cash return, DSCR, and the 1% rule in one view.',
				'Save deals and compare up to three side by side.',
				'Watch a buy box and track up to five ZIP codes.'
			]
		},
		{
			title: 'Where your keys go',
			body: 'Typing in your own numbers needs no key and uses no calls. A free RentCast key adds rent and value estimates, for-sale searches, and market data. An AI key is optional, for drafting a deal memo. Each key goes straight from your browser to its service. Tran has no server and never receives it.'
		},
		SAMPLE_OR_LIVE
	],
	agent: [
		{
			title: 'What the agent portal does',
			list: [
				'Collect leads with an inquiry page that emails them to you.',
				'Move contacts through your pipeline and see which follow-ups are due today.',
				'Draft follow-ups and listing content, checked for Fair Housing problem phrases before you copy them.'
			]
		},
		{
			title: 'Where your keys go',
			body: "Your pipeline and follow-ups don't use RentCast. Your inquiry page uses your own free Web3Forms access key, and a RentCast key only matters for Market Snapshot reports. An AI key from Anthropic, OpenAI, Google, or OpenRouter is optional, for drafting. Each key goes straight from your browser to its service. Tran has no server and never receives it."
		},
		{
			title: 'Sample contacts or your own',
			body: 'Sample contacts are made up, so you can try the pipeline without entering anyone real. Or start empty and add your own leads. Everything stays in this browser.'
		}
	]
} satisfies Record<OnboardingPortalName, [TourStep, TourStep, TourStep]>;

export const SETUP_COPY = {
	h1: 'Connect a free RentCast key',
	lead: 'Three steps, about five minutes. You can stop at any point and use sample data instead.',
	description:
		'Set up a free RentCast API key for Tran Real Estate Tools, test it, and set a monthly call cap.',
	step1: {
		heading: 'Create a key just for Tran',
		list: [
			"Sign up for RentCast's free Developer plan. It includes 50 calls a month and doesn't need a card.",
			'Create a new API key just for Tran, so you can delete it without affecting anything else.',
			'If your dashboard lets you limit a key to certain endpoints, allow rental listings, sale listings, property estimates, and market data.',
			'Only add a card if you mean to. With a card on file, RentCast bills each call past 50 at $0.20.'
		],
		dashboardLink: 'Open the RentCast API dashboard',
		helper: 'Come back to this page when you have your key. Nothing here is lost.'
	},
	step2: {
		heading: 'Paste and test your key',
		paragraph: "Paste the key, save it, then test it. Testing doesn't use a call.",
		storageBefore:
			'Keys are kept for this tab only. To keep them after you close the browser, change this in ',
		storageLink: 'Key security',
		storageAfter: '.'
	},
	step3: {
		heading: 'Set your monthly call cap',
		paragraph:
			"Tran counts every call made from this browser and stops before your cap. 40 leaves room under RentCast's free 50."
	},
	badges: { done: 'Done', todo: 'To do', defaultCap: 'Default: 40' },
	finish: {
		heading: 'Open your portal',
		ready: 'Your key is saved and tested. Portals will use RentCast data.',
		notReady: 'No tested key yet. Portals will use sample data until you add one.',
		open: (p: OnboardingPortalName) => `Open ${p} portal`,
		sample: 'Use sample data for now'
	}
} as const;

export const SETTINGS_COPY = {
	heading: 'Getting started',
	paragraph: 'Take the short tour again, or set up a RentCast key step by step.',
	showTour: 'Show the tour again',
	setupKey: 'Set up a RentCast key',
	feedbackBefore: 'Have an idea or found a problem? ',
	feedbackLink: 'Send feedback',
	feedbackAfter: '.'
} as const;

/** All onboarding copy. Components import the named parts so the landing bundles only guide + tours. */
export const ONBOARDING_COPY = {
	guide: GUIDE_COPY,
	tours: TOURS,
	setup: SETUP_COPY,
	settings: SETTINGS_COPY
} as const;
