// Audience-page copy for /for-renters/, /for-investors/ and /for-agents/.
// Lives in $lib/content (never $lib/data) so marketing routes may import it.
// Every string is scanned by the banned-terms gate.

import { renterAudience } from './audience-renter';
import { investorAudience } from './audience-investor';
import { agentAudience } from './audience-agent';

export type PortalId = 'renter' | 'investor' | 'agent';

export type FeatureIcon =
	| 'search'
	| 'bell'
	| 'scale'
	| 'message-square-text'
	| 'calculator'
	| 'columns-2'
	| 'target'
	| 'map-pin'
	| 'inbox'
	| 'list-checks'
	| 'pen-line'
	| 'file-text';

export interface Feature {
	icon: FeatureIcon;
	title: string;
	body: string;
}

export interface Audience {
	portal: PortalId;
	slug: 'for-renters' | 'for-investors' | 'for-agents';
	docTitle: string;
	description: string;
	eyebrow: string;
	title: string;
	lead: string;
	featuresHeading: string;
	features: readonly Feature[];
	limitsHeading: 'Good to know';
	limits: readonly string[];
	closingHeading: string;
	openLabel: string;
}

export { renterAudience, investorAudience, agentAudience };

// Every audience, keyed by portal. Each /for-*/ page imports only its own *Audience, so it does
// not ship the other two pages' copy.
export const audiences: Record<PortalId, Audience> = {
	renter: renterAudience,
	investor: investorAudience,
	agent: agentAudience
};
