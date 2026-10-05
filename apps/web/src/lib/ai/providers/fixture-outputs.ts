/**
 * Canned sample outputs for the keyless Fixture provider, keyed by promptId plus 'default'.
 * Every value must pass the Fair Housing checker and the banned-terms gate (fixture.test.ts
 * enforces the checker). Contact details appear only as `{role}` tokens, mirroring exactly what
 * a live model receives after redaction. Portal phases add their own sample outputs here.
 */
export const FIXTURE_OUTPUTS = {
	'shared/demo@1':
		"Hi,\n\nI'm interested in the 2-bedroom, 1-bath apartment at 18 Example Lane in Springfield. Is it still available, and when could I schedule a tour?\n\nCould you tell me about the pet policy, any application or move-in fees, and the lease length you're offering? I'd also like to know whether utilities are included in the $1,850 rent.\n\nThanks for your help,\n{client_name}\n{client_email} · {client_phone}",
	// Phase 6 renter outreach (RENT-07): asks whether the home is open instead of claiming it is.
	'renter/outreach.v1@1':
		"Hello,\n\nI'm interested in the rental at the address in your listing and have a few questions before I apply.\n\n- Is the home open for a move-in around my preferred date? If not, what is the earliest move-in date?\n- What is your pet policy, and are there pet fees or pet rent?\n- What are the application fee and the security deposit?\n- What lease lengths do you offer, and what is included in the rent?\n\nThank you for your time. I look forward to hearing from you.\n\nBest regards,\n{your_name}",
	default:
		'Here is a short sample draft. It describes the home, its features, and the next steps, so you can see how drafting works before you add a key.'
} as const satisfies Readonly<Record<string, string>>;
