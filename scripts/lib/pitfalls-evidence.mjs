// Declared evidence for every item of the PITFALLS.md "Looks Done But Isn't" checklist, read by
// scripts/launch-audit.mjs. Keys are the bold labels of the checklist lines; launch-audit.test.ts
// fails when a checklist line has no entry here or an entry has no checklist line.
//
// kind 'auto'  : status comes from real results. Every evidence row must match at least one
//                PASSING test (or a command that exited 0); no match, a failing match, or a
//                missing report renders FAIL. Never PASS by default.
//   { type: 'unit',    match } substring of "<repo-relative test file> > <describe> > <title>"
//                              in the Vitest JSON report
//   { type: 'e2e',     match } substring of "<spec file> > <describe> > <title>" in the
//                              Playwright JSON report (every project that ran it)
//   { type: 'command', match } a COMMAND_GATES id in launch-audit.mjs; PASS iff exit code 0
// kind 'human' : DEFERRED (human); `reason` says why, `human` names the HUMAN_UAT step.
// kind 'na'    : N/A; `reason` says why.
// An 'auto' entry may also carry `human`: the automated part decides the status and the audit
// links the extra owner step in the Human UAT section.

/** Owner-only steps, rendered in order as the numbered "Human UAT (deferred)" section. */
export const HUMAN_UAT = Object.freeze([
	{
		id: 'analytics',
		title: 'Usage counts delivery',
		step: 'With PUBLIC_ANALYTICS_HOST set, open the deployed site in a normal browser and confirm one page view arrives in the Umami dashboard; repeat with Global Privacy Control on and confirm nothing arrives; confirm in the Umami settings that IP addresses are not stored.'
	},
	{
		id: 'web3forms',
		title: 'Waitlist and feedback forms end to end',
		step: "With the owner's PUBLIC_WEB3FORMS_KEY, submit the waitlist and the feedback form on the deployed site and confirm both emails arrive; confirm captcha is off in the Web3Forms dashboard (the CSP forbids third-party captcha scripts)."
	},
	{
		id: 'contact-email',
		title: 'Contact email',
		step: 'With PUBLIC_CONTACT_EMAIL set, open the feedback page error state and confirm the mailto link opens a message to that address and the mailbox receives it.'
	},
	{
		id: 'share-cards',
		title: 'Share cards',
		step: 'Paste the landing URL and one tool page URL into a share-card debugger (for example the LinkedIn Post Inspector) and confirm the title, description and 1200 x 630 image render.'
	},
	{
		id: 'search-console',
		title: 'Search Console sitemap',
		step: 'Add the property in Google Search Console, submit sitemap.xml, and confirm it is read with the expected URL count and no errors.'
	},
	{
		id: 'pages-deep-link',
		title: 'Pages deep-link refresh',
		step: 'On the live URL, open a deep portal route (for example /investor/deals/), hard-refresh it, and confirm the app loads rather than a GitHub 404 (docs/DEPLOY-CHECKLIST.md Step 7).'
	},
	{
		id: 'provider-keys',
		title: 'Provider key tests from the deployed URL',
		step: 'From the deployed Pages URL (not localhost), paste a real key for each of Anthropic, OpenAI and Gemini in Settings, press Test connection for each, and confirm each reports success; then press Forget all keys and confirm every key is gone.'
	},
	{
		id: 'safari-persistence',
		title: 'Safari storage persistence',
		step: 'On a real device running Safari 17 or later, open Settings and confirm the storage persistence result (granted or not granted) is shown.'
	},
	{
		id: 'secret-scanning',
		title: 'Secret scanning and push protection',
		step: 'In the GitHub repository settings, confirm secret scanning and push protection are enabled (docs/DEPLOY-CHECKLIST.md Step 5).'
	}
]);

const EXTENSION_REASON =
	'Phase 11 browser extension is outside the web launch (ROADMAP: Phase 10 does not depend on Phase 11).';

export const PITFALLS_EVIDENCE = Object.freeze({
	'RentCast client': {
		kind: 'auto',
		evidence: [
			{ type: 'unit', match: 'packages/core/src/budget/cap.test.ts' },
			{ type: 'unit', match: 'apps/web/src/lib/data/gateway.budget.test.ts' },
			{ type: 'e2e', match: 'CapAboveLimitDialog: focus on Keep, typed confirmation' }
		]
	},
	'Saved-search alerts': {
		kind: 'auto',
		evidence: [
			{ type: 'unit', match: 'apps/web/src/lib/data/scheduler.test.ts' },
			{ type: 'unit', match: 'a second pass at once, or 23 h later, spends 0' }
		]
	},
	'BYOK settings': {
		kind: 'auto',
		evidence: [
			{ type: 'unit', match: 'apps/web/src/lib/storage/secrets/testers.test.ts' },
			{ type: 'unit', match: 'apps/web/src/lib/storage/secrets/vault.test.ts > forgetAll' },
			{ type: 'unit', match: 'apps/web/src/lib/ai/providers/anthropic.test.ts' },
			{ type: 'e2e', match: 'settings-keys.spec.ts' }
		],
		human: 'provider-keys'
	},
	'LLM output rendering': {
		kind: 'auto',
		evidence: [
			{ type: 'unit', match: 'sanitizer module is the only place {@html} is allowed' },
			{ type: 'unit', match: 'the same {@html} outside the sanitizer module is rejected' },
			{ type: 'unit', match: 'HTML-like model text is escaped, never parsed' },
			{ type: 'e2e', match: 'hostile params render as text' }
		]
	},
	CSP: {
		kind: 'auto',
		evidence: [
			{ type: 'command', match: 'csp' },
			{ type: 'e2e', match: 'csp.spec.ts' }
		]
	},
	'Pages deploy': {
		kind: 'human',
		reason:
			'Needs the live GitHub Pages origin: a hard refresh on a deep portal route can only be checked after deploy.',
		human: 'pages-deep-link'
	},
	'Demo mode': {
		kind: 'auto',
		evidence: [
			{ type: 'e2e', match: 'axe reports no WCAG A/AA violations on' },
			{ type: 'e2e', match: 'renter-demo-credible.spec.ts' },
			{ type: 'e2e', match: 'agent-no-rentcast.spec.ts' },
			{ type: 'e2e', match: 'studio-keyless.spec.ts' }
		]
	},
	Fixtures: {
		kind: 'auto',
		evidence: [
			{ type: 'command', match: 'guard' },
			{ type: 'command', match: 'fixtures:check' }
		]
	},
	'Export/Import': {
		kind: 'auto',
		evidence: [
			{ type: 'unit', match: 'round-trips to an equal envelope with migratedFrom null' },
			{ type: 'unit', match: 'an older file is migrated forward and reports migratedFrom' },
			{ type: 'unit', match: 'packages/core/src/backup/migrations.test.ts' },
			{ type: 'e2e', match: 'settings-backup.spec.ts' }
		]
	},
	'Storage persistence': {
		kind: 'auto',
		evidence: [
			{ type: 'unit', match: 'apps/web/src/lib/storage/persistence.test.ts' },
			{ type: 'e2e', match: 'settings-storage.spec.ts' }
		],
		human: 'safari-persistence'
	},
	'Fair Housing linter': {
		kind: 'auto',
		evidence: [
			{ type: 'unit', match: 'at least 30 bad and 30 neutral phrases' },
			{ type: 'unit', match: 'packages/core/src/fair-housing/check.test.ts' },
			{ type: 'unit', match: 'packages/core/src/fair-housing/mutation.test.ts' }
		]
	},
	Disclaimers: {
		kind: 'auto',
		evidence: [{ type: 'e2e', match: 'disclaimer: ' }]
	},
	'Agent exports': {
		kind: 'auto',
		evidence: [
			{ type: 'unit', match: 'apps/web/src/lib/features/studio/snapshot/build-record.test.ts' },
			{
				type: 'unit',
				match: 'apps/web/src/lib/features/shared/agent-profile/agent-profile.test.ts'
			},
			{ type: 'e2e', match: 'snapshot-print.spec.ts' }
		]
	},
	'Lead form': {
		kind: 'auto',
		evidence: [
			{ type: 'e2e', match: 'honeypot sends nothing but shows success' },
			{ type: 'unit', match: 'a minimal link has only key, name and brokerage' },
			{ type: 'unit', match: 'apps/web/src/lib/leads/web3forms-sink.test.ts' }
		],
		reason:
			'Captcha is intentionally off: the CSP forbids third-party captcha scripts (RESEARCH Pitfall 10); the honeypot and minimum fill time stand in. The agent email never enters the page: the link carries only the public Web3Forms access key, name and brokerage.'
	},
	Extension: { kind: 'na', reason: EXTENSION_REASON },
	'Extension listing': { kind: 'na', reason: EXTENSION_REASON },
	Secrets: {
		kind: 'auto',
		evidence: [
			{ type: 'command', match: 'secrets:canary' },
			{ type: 'command', match: 'secrets:scan' }
		],
		human: 'secret-scanning'
	}
});
