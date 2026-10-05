/**
 * The three fictional sample metros, for one-tap sample locations (Phases 6 and 7).
 * A static constant on purpose: the public data port can export it without loading fixtures.
 * fixture-fetch.test.ts asserts it matches metros.json.
 */
export const SAMPLE_METROS: readonly {
	city: string;
	state: string;
	zipCodes: readonly string[];
	label: string;
}[] = [
	{
		city: 'Harlow Springs',
		state: 'OK',
		zipCodes: ['74201', '74203'],
		label: 'Harlow Springs, OK'
	},
	{ city: 'Bayou Verde', state: 'LA', zipCodes: ['70201', '70204'], label: 'Bayou Verde, LA' },
	{ city: 'Juniper Mesa', state: 'AZ', zipCodes: ['85801', '85806'], label: 'Juniper Mesa, AZ' }
];
