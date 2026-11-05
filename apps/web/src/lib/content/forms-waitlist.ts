// Waitlist form copy (GTM-02), verbatim from the Phase 10 UI-SPEC copywriting contract
// ("Waitlist (per audience page)"). `portal` is lower case ("renter"); `Portal` is the capitalized
// name ("Renter"). Its own module, so /feedback/ does not ship this copy.

export const WAITLIST_COPY = Object.freeze({
	eyebrow: 'Waitlist',
	heading: (portal: string) => `Join the ${portal} waitlist`,
	paragraph: (portal: string) =>
		`Tran Real Estate Tools is new and still changing. Leave your email and we'll write when there's news about the ${portal} portal. There's no set schedule.`,
	label: 'Email',
	privacy: (portal: string) =>
		`Web3Forms, our form service, emails your address to the Tran team. It's used only for ${portal} portal news. Reply to any message to be removed.`,
	button: 'Join the waitlist',
	sending: 'Joining…',
	validation: Object.freeze({
		empty: 'Enter your email address.',
		shape: 'Enter an email address like name@example.com.'
	}),
	tooFast:
		'That was quicker than expected. Check your email address, then select Join the waitlist again.',
	successTitle: (portal: string) => `You're on the ${portal} waitlist`,
	successBody:
		"Thanks. Your email was sent to the Tran team. Reply to any message from us if you'd like to be removed.",
	successAnnouncement: (portal: string) => `You're on the ${portal} waitlist.`,
	networkError: Object.freeze({
		title: "Your email wasn't sent",
		body: 'Check your connection, then try again. Nothing was saved.'
	}),
	rejectedError: Object.freeze({
		title: "The form service didn't accept this",
		body: 'Try again in a few minutes.'
	}),
	comingSoonTitle: "The waitlist isn't open yet",
	comingSoonContactBody: "Email us instead and we'll add you by hand.",
	comingSoonBody: 'Please check back later.',
	comingSoonLink: 'Email the Tran team',
	mailSubject: (Portal: string) => `Tran ${Portal} waitlist`
});
