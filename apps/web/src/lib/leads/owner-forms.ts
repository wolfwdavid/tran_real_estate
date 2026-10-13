// Delivery for the site's own forms (GTM-02 waitlist and feedback). They post with the OWNER's
// Web3Forms key, baked in at build time (lib/site.ts WEB3FORMS_KEY); without it the forms render
// as coming-soon panels and this is never called. Same single request and response mapping as the
// agent inquiry sink. Nothing is stored in the browser.
import type { FeedbackBody, WaitlistBody } from '$lib/components/forms/form-gate';
import { postWeb3Forms, type SinkResult } from './web3forms-sink';

export type OwnerFormBody = WaitlistBody | FeedbackBody;

export async function submitOwnerForm(
	body: OwnerFormBody,
	fetchImpl?: typeof fetch
): Promise<SinkResult> {
	return postWeb3Forms(body, fetchImpl);
}
