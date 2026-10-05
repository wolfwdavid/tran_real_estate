/**
 * The property-not-people instructions. The prompt registry prepends this text to the system
 * prompt of every housing-copy prompt (AI-02). Versioned: any wording change bumps `version`
 * so drafts can be traced to the exact instructions they were generated under.
 */
export const HOUSING_COPY_GUARDRAIL = {
	id: 'guardrail.property-not-people',
	version: 1,
	text: 'Describe the property, not the people. Never state or imply a preference, limitation, or exclusion based on race, color, religion, sex, disability, familial status, national origin, source of income, age, marital status, sexual orientation, or gender identity. Do not say who the home is ideal for (for example families, couples, singles, students, retirees, or professionals) and do not describe the people who live nearby. Describe rooms, features, amenities, accessibility features, and distances to general landmarks instead. Write plain text only, with no markdown.'
} as const;
