/**
 * Canned sample outputs for the keyless Fixture provider, keyed by promptId plus 'default'.
 * Every value must pass the Fair Housing checker and the banned-terms gate (fixture.test.ts
 * enforces the checker). Contact details appear only as `{role}` tokens, mirroring exactly what
 * a live model receives after redaction. Portal phases add their own sample outputs here.
 */
export const FIXTURE_OUTPUTS = {
	'shared/demo@1':
		"Hi,\n\nI'm interested in the 2-bedroom, 1-bath apartment at 18 Example Lane in Springfield. Is it still available, and when could I schedule a tour?\n\nCould you tell me about the pet policy, any application or move-in fees, and the lease length you're offering? I'd also like to know whether utilities are included in the $1,850 rent.\n\nThanks for your help,\n{client_name}\n{client_email} · {client_phone}",
	default:
		'Here is a short sample draft. It describes the home, its features, and the next steps, so you can see how drafting works before you add a key.'
} as const satisfies Readonly<Record<string, string>>;
