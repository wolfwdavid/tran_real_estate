// Per-state license-title and team-name warnings for the Content Studio (STU-01, STU-02).
//
// Sources: NY 19 NYCRR 175.25 (c)(4) titles and (e)(1) team names, TX 22 TAC 535.154/535.155,
// FL s. 475.2755 entity words, CA B&P 10159.7. These are warnings only: no state
// hard-blocks the agent, and bad input only yields warnings. Pure and DOM-free.

export const LICENSE_TYPE_OPTIONS = [
	'Licensed Real Estate Salesperson',
	'Licensed Associate Real Estate Broker',
	'Licensed Real Estate Broker',
	'Sales Associate',
	'Other'
] as const;

export interface StudioWarning {
	code: string;
	message: string;
}

const NY_BAD_TITLES: readonly string[] = [
	'sales associate',
	'broker',
	'licensed sales agent',
	'sales agent'
];

const NY_TEAM_FORBIDDEN: readonly string[] = ['group', 'realty', 'associate', 'associates'];
const TX_TEAM_FORBIDDEN: readonly string[] = ['brokerage', 'company', 'associates'];
const FL_TEAM_FORBIDDEN: readonly string[] = [
	'Agency',
	'Associates',
	'Brokerage',
	'Brokers',
	'Company',
	'Corp.',
	'Inc.',
	'LLC',
	'Partnership',
	'Properties',
	'Property',
	'Real Estate',
	'Realty'
];
const CA_TEAM_ENTITY: readonly string[] = ['Inc.', 'LLC', 'Corp.', 'Company', 'Brokerage'];

const normState = (state: string): string => state.trim().toUpperCase();

/** Unicode-aware whole-word pattern; a trailing period in the word is optional. */
function wordPattern(word: string): RegExp {
	const escaped = word
		.replace(/\.$/, '')
		.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		.replace(/ /g, '\\s+');
	const dot = word.endsWith('.') ? '\\.?' : '';
	return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}${dot}(?![\\p{L}\\p{N}])`, 'iu');
}

/** Words from `list` found in `name`, in list order, as the agent typed them. */
function foundWords(name: string, list: readonly string[]): string[] {
	const out: string[] = [];
	for (const word of list) {
		const m = wordPattern(word).exec(name);
		if (m) out.push(m[0]);
	}
	return out;
}

export function validateLicenseTitle(licenseType: string, state: string): StudioWarning[] {
	const title = licenseType.trim();
	if (title === '' || normState(state) !== 'NY') return [];
	if (!NY_BAD_TITLES.includes(title.toLowerCase())) return [];
	return [
		{
			code: 'ny-title',
			message: `In New York, use your exact license title, like "Licensed Real Estate Salesperson". "${title}" isn't allowed in ads.`
		}
	];
}

export function validateTeamName(name: string, state: string): StudioWarning[] {
	const team = name.trim();
	if (team === '') return [];
	const out: StudioWarning[] = [];
	switch (normState(state)) {
		case 'NY':
			if (!wordPattern('team').test(team)) {
				out.push({
					code: 'ny-team-word',
					message: 'In New York, a team name must include the word "Team".'
				});
			}
			for (const w of foundWords(team, NY_TEAM_FORBIDDEN)) {
				out.push({
					code: 'ny-team-forbidden',
					message: `In New York, a team name can't use "${w}".`
				});
			}
			break;
		case 'TX':
			if (!/(?<![\p{L}\p{N}])(team|group)$/iu.test(team)) {
				out.push({
					code: 'tx-team-suffix',
					message: 'In Texas, a team name must end with "Team" or "Group".'
				});
			}
			for (const w of foundWords(team, TX_TEAM_FORBIDDEN)) {
				out.push({ code: 'tx-team-forbidden', message: `In Texas, a team name can't use "${w}".` });
			}
			break;
		case 'FL':
			for (const w of foundWords(team, FL_TEAM_FORBIDDEN)) {
				out.push({
					code: 'fl-team-forbidden',
					message: `In Florida, a team name can't use "${w}".`
				});
			}
			break;
		case 'CA':
			for (const w of foundWords(team, CA_TEAM_ENTITY)) {
				out.push({
					code: 'ca-team-entity',
					message: `In California, a team name can't suggest a business separate from your brokerage, so leave out "${w}".`
				});
			}
			break;
		default:
			break;
	}
	return out;
}
