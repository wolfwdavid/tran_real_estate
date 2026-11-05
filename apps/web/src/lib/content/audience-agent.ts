// /for-agents/ copy, in its own module so each audience page ships only its own content.
// Every string is scanned by the banned-terms gate.
import type { Audience } from './audiences';

export const agentAudience: Audience = {
	portal: 'agent',
	slug: 'for-agents',
	docTitle: 'For agents: Tran Real Estate Tools',
	description:
		'Agent tools: a lead inbox, a pipeline with follow-ups, and Fair Housing-checked listing content.',
	eyebrow: 'For agents',
	title: 'Leads, follow-ups, and content in one place',
	lead: 'Run your pipeline, follow-ups, and listing content from one browser tab, with your license and brokerage disclosures added to what you export.',
	featuresHeading: 'What the agent portal does',
	features: [
		{
			icon: 'inbox',
			title: 'Collect leads',
			body: 'Publish an inquiry page that sends new leads to your inbox through your own Web3Forms key.'
		},
		{
			icon: 'list-checks',
			title: 'Work your pipeline',
			body: 'Move contacts from New to Closed and see which follow-ups are due today.'
		},
		{
			icon: 'pen-line',
			title: 'Draft listing content',
			body: 'Listing descriptions and social posts are checked for Fair Housing problem phrases before you copy them.'
		},
		{
			icon: 'file-text',
			title: 'Share a market snapshot',
			body: 'Print a branded ZIP-code report to PDF, clearly labeled as an informational snapshot.'
		}
	],
	limitsHeading: 'Good to know',
	limits: [
		'Your contacts and pipeline live in your browser. Back them up, because Tran has no server copy.',
		"Tran doesn't replace your brokerage's tools or compliance review.",
		'AI drafts are starting points. Nothing is sent automatically.'
	],
	closingHeading: 'Start with the agent portal',
	openLabel: 'Open agent portal'
};
