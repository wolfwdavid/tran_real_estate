// Copy for the site's own forms (GTM-02), verbatim from the Phase 10 UI-SPEC copywriting contract
// ("Waitlist (per audience page)" and "Feedback (/feedback/)"). `portal` is lower case
// ("renter"); `Portal` is the capitalized name ("Renter").

import { WAITLIST_COPY } from './forms-waitlist';
import { FEEDBACK_COPY } from './forms-feedback';

export { WAITLIST_COPY, FEEDBACK_COPY };

// Every form's copy. The forms import $lib/content/forms-waitlist or forms-feedback directly: the
// Object.freeze call here is not treated as pure by the bundler, so importing this module would
// pull both forms' copy into every page that has either form.
export const FORMS_COPY = Object.freeze({
	waitlist: WAITLIST_COPY,
	feedback: FEEDBACK_COPY,
	/** Appended to an error body when a contact address is configured. */
	contactLine: (contactEmail: string) => `Or email ${contactEmail}.`
});
