// Synthetic agent profile. Consumed by the follow-up composer for sample contacts (UI-SPEC) and
// the inquiry `?demo=1` page. Scanned by the real-data guard: example.com and 555-01xx only.
import type { ProfileInput } from '../types.js';

export const SAMPLE_AGENT_PROFILE: ProfileInput = Object.freeze({
	id: 'profile',
	name: 'Avery Sample',
	brokerage: 'Sample Realty',
	teamName: '',
	licenseType: 'salesperson',
	licenseNumber: 'SAMPLE-0001',
	licenseState: 'TX',
	brokerageLicenseNumber: '',
	brokeragePhone: '(555) 555-0100',
	phone: '(555) 555-0199',
	email: 'avery@example.com',
	website: 'https://example.com',
	iabsUrl: '',
	postal: Object.freeze({
		street: '12 Sample Lane',
		line2: '',
		city: 'Harlow Springs',
		state: 'TX',
		zip: '75001'
	}),
	brandPrimary: '',
	brandAccent: '',
	logo: null,
	web3formsAccessKey: ''
}) as ProfileInput;
