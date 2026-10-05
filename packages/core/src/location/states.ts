// The 50 US states plus the District of Columbia with their USPS abbreviations. RentCast's `state`
// parameter takes the two-letter abbreviation, so every location input resolves to one of these.

export interface UsState {
	readonly abbr: string;
	readonly name: string;
}

export const US_STATES: readonly UsState[] = [
	{ abbr: 'AL', name: 'Alabama' },
	{ abbr: 'AK', name: 'Alaska' },
	{ abbr: 'AZ', name: 'Arizona' },
	{ abbr: 'AR', name: 'Arkansas' },
	{ abbr: 'CA', name: 'California' },
	{ abbr: 'CO', name: 'Colorado' },
	{ abbr: 'CT', name: 'Connecticut' },
	{ abbr: 'DE', name: 'Delaware' },
	{ abbr: 'DC', name: 'District of Columbia' },
	{ abbr: 'FL', name: 'Florida' },
	{ abbr: 'GA', name: 'Georgia' },
	{ abbr: 'HI', name: 'Hawaii' },
	{ abbr: 'ID', name: 'Idaho' },
	{ abbr: 'IL', name: 'Illinois' },
	{ abbr: 'IN', name: 'Indiana' },
	{ abbr: 'IA', name: 'Iowa' },
	{ abbr: 'KS', name: 'Kansas' },
	{ abbr: 'KY', name: 'Kentucky' },
	{ abbr: 'LA', name: 'Louisiana' },
	{ abbr: 'ME', name: 'Maine' },
	{ abbr: 'MD', name: 'Maryland' },
	{ abbr: 'MA', name: 'Massachusetts' },
	{ abbr: 'MI', name: 'Michigan' },
	{ abbr: 'MN', name: 'Minnesota' },
	{ abbr: 'MS', name: 'Mississippi' },
	{ abbr: 'MO', name: 'Missouri' },
	{ abbr: 'MT', name: 'Montana' },
	{ abbr: 'NE', name: 'Nebraska' },
	{ abbr: 'NV', name: 'Nevada' },
	{ abbr: 'NH', name: 'New Hampshire' },
	{ abbr: 'NJ', name: 'New Jersey' },
	{ abbr: 'NM', name: 'New Mexico' },
	{ abbr: 'NY', name: 'New York' },
	{ abbr: 'NC', name: 'North Carolina' },
	{ abbr: 'ND', name: 'North Dakota' },
	{ abbr: 'OH', name: 'Ohio' },
	{ abbr: 'OK', name: 'Oklahoma' },
	{ abbr: 'OR', name: 'Oregon' },
	{ abbr: 'PA', name: 'Pennsylvania' },
	{ abbr: 'RI', name: 'Rhode Island' },
	{ abbr: 'SC', name: 'South Carolina' },
	{ abbr: 'SD', name: 'South Dakota' },
	{ abbr: 'TN', name: 'Tennessee' },
	{ abbr: 'TX', name: 'Texas' },
	{ abbr: 'UT', name: 'Utah' },
	{ abbr: 'VT', name: 'Vermont' },
	{ abbr: 'VA', name: 'Virginia' },
	{ abbr: 'WA', name: 'Washington' },
	{ abbr: 'WV', name: 'West Virginia' },
	{ abbr: 'WI', name: 'Wisconsin' },
	{ abbr: 'WY', name: 'Wyoming' }
];

const BY_KEY: ReadonlyMap<string, string> = new Map(
	US_STATES.flatMap((s) => [
		[s.abbr.toLowerCase(), s.abbr],
		[s.name.toLowerCase(), s.abbr]
	])
);

/** Abbreviation or full state name (case-insensitive, whitespace-collapsed) → USPS abbr, else null. */
export function stateFromInput(input: string): string | null {
	const key = input.trim().replace(/\s+/g, ' ').toLowerCase();
	return BY_KEY.get(key) ?? null;
}
