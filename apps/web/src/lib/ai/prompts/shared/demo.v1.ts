/**
 * The one generic demo prompt ("Try a draft" in Settings). Its inputs are fictional
 * (example.com email, 555-01xx phone) so the "What will be sent" view can show redaction
 * working on realistic-looking client data.
 */
import type { PromptDef } from '../types.js';

export type DemoInputs = {
	clientName: string;
	clientEmail: string;
	clientPhone: string;
	listing: string;
};

export const DEMO_INPUTS: DemoInputs = {
	clientName: 'Jordan Rivera',
	clientEmail: 'jordan.rivera@example.com',
	clientPhone: '(212) 555-0147',
	listing:
		'2-bedroom, 1-bath apartment at 18 Example Lane, Springfield. Rent is $1,850 per month. In-unit laundry, elevator building, near transit.'
};

export const demoV1: PromptDef<DemoInputs> = {
	id: 'shared/demo',
	version: 1,
	feature: 'demo',
	housingCopy: true,
	containsClientData: true,
	maxTokens: 2048,
	build: (i) => ({
		system:
			'You write short, friendly inquiry emails from a renter to a listing agent. Write a greeting, two or three short paragraphs, and a sign-off. Ask about availability, pets, fees, and lease terms.',
		user: `Write an inquiry from ${i.clientName} (email ${i.clientEmail}, phone ${i.clientPhone}) about this listing: ${i.listing}`,
		known: [
			{ value: i.clientName, token: 'client_name', kind: 'name' },
			{ value: i.clientEmail, token: 'client_email', kind: 'email' },
			{ value: i.clientPhone, token: 'client_phone', kind: 'phone' }
		]
	})
};
