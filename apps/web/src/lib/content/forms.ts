// Copy for the site's own forms (GTM-02), verbatim from the Phase 10 UI-SPEC copywriting contract
// ("Waitlist (per audience page)" and "Feedback (/feedback/)"). `portal` is lower case
// ("renter"); `Portal` is the capitalized name ("Renter").

export const FORMS_COPY = Object.freeze({
	waitlist: Object.freeze({
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
	}),
	feedback: Object.freeze({
		h1: 'Send feedback',
		lead: "Tell us what's working, what's confusing, or what's broken. Your message goes to the team that builds Tran.",
		meta: 'Send feedback about Tran Real Estate Tools: the renter, investor, and agent portals and the free calculators.',
		legend: 'Which part of Tran is this about?',
		messageLabel: 'Your feedback',
		messageHelper: "Don't include API keys, passwords, or anyone's personal details.",
		counter: (n: number) => `${n.toLocaleString('en-US')} of 2,000 characters`,
		counterLeft: (r: number) => `${r.toLocaleString('en-US')} characters left`,
		emailLabel: 'Email (optional)',
		emailHelper: "Only if you'd like a reply.",
		button: 'Send feedback',
		sending: 'Sending…',
		validation: Object.freeze({
			empty: 'Write a few words before sending.',
			shape: 'Enter an email address like name@example.com, or leave it blank.',
			keyFound: 'This looks like it contains an API key. Remove it, then send again.'
		}),
		tooFast: 'That was quicker than expected. Check your message, then select Send feedback again.',
		successTitle: 'Thanks. Your feedback was sent.',
		successBody: 'If you left an email, we may write back.',
		successAnnouncement: 'Thanks. Your feedback was sent.',
		sendMore: 'Send more feedback',
		backHome: 'Back to the home page',
		networkError: Object.freeze({
			title: "Your message wasn't sent",
			body: 'Check your connection, then try again. Nothing was saved.'
		}),
		rejectedError: Object.freeze({
			title: "The form service didn't accept this",
			body: 'Try again in a few minutes.'
		}),
		comingSoonTitle: "The feedback form isn't open yet",
		comingSoonContactBody: 'Email your feedback instead.',
		comingSoonBody: 'Please check back later.',
		comingSoonLink: 'Email feedback',
		mailSubject: 'Tran feedback'
	}),
	/** Appended to an error body when a contact address is configured. */
	contactLine: (contactEmail: string) => `Or email ${contactEmail}.`
});
