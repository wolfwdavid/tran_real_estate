// Feedback form copy (GTM-02), verbatim from the Phase 10 UI-SPEC copywriting contract
// ("Feedback (/feedback/)"). Its own module, so the audience pages do not ship this copy.

export const FEEDBACK_COPY = Object.freeze({
	h1: 'Send feedback',
	lead: "Tell us what's working, what's confusing, or what's broken. Your message goes to the team that builds Tran.",
	meta: 'Send feedback about Tran Real Estate Tools: the renter, investor, and agent portals and the free calculators.',
	legend: 'Which part of Tran is this about?',
	messageLabel: 'Your feedback',
	messageHelper: "Don't include API keys, passwords, or anyone's personal details.",
	counter: (n: number) => `${n.toLocaleString('en-US')} of 2,000 characters`,
	counterLeft: (r: number) =>
		`${r.toLocaleString('en-US')} ${r === 1 ? 'character' : 'characters'} left`,
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
});
