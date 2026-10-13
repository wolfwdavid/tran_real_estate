// Get started guide strings the landing needs on first paint (step 0, Hide, compact row). Kept in
// their own module so the landing's initial JS does not carry the tour copy: the tour panel, the
// setup page and Settings import the rest from ./onboarding, which re-exports these.
// Marketing-safe: imports nothing.

export const GUIDE_INTRO_COPY = {
	eyebrow: 'Get started',
	heading: 'Get started',
	lead: "Where do you want to start? Pick a portal and we'll show you around in three short steps. You can close this guide at any time.",
	helper: 'No account needed. Everything you save stays in this browser.',
	hide: 'Hide this guide',
	hidden: 'Guide hidden. You can show it again from Settings or here.',
	tiles: {
		renter: {
			title: 'Renter',
			description: "Find rentals and see what's new each time you come back.",
			action: 'Start the tour'
		},
		investor: {
			title: 'Investor',
			description: 'Run the numbers on a property before you spend a weekend on it.',
			action: 'Start the tour'
		},
		agent: {
			title: 'Agent',
			description: 'Keep leads, follow-ups, and listing content in one place.',
			action: 'Start the tour'
		}
	},
	compact: {
		text: 'New here, or want a refresher?',
		show: 'Show me around',
		open: (p: 'renter' | 'investor' | 'agent') => `Open ${p} portal`
	},
	heroCta: 'Show me around'
} as const;
