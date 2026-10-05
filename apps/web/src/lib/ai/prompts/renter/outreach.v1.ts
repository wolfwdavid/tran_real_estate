/**
 * Renter outreach (RENT-07): a short email from a prospective renter to the listing contact,
 * asking about availability and move-in timing, pets, fees, and lease terms.
 *
 * Fair Housing by construction: the input type has no field for household makeup. The only
 * household detail is `occupants`, a whole number; pets are yes/no plus a short description.
 * The listing contact's name is declared PII (sent as `{contact_name}`), and the free-text
 * question goes through redactPii in buildPrompt (stray emails and phones become tokens).
 */
import type { PromptDef } from '../types.js';

export const RENTER_OUTREACH_PROMPT_ID = 'renter/outreach.v1';
export const RENTER_OUTREACH_FEATURE = 'renter-outreach';

const MAX_OCCUPANTS = 12;
const PET_DESCRIPTION_MAX = 60;
const EXTRA_QUESTION_MAX = 500;

/** Listing facts only. Nothing about the people who live in or near the home. */
export interface RenterOutreachListing {
	streetLine: string;
	city: string;
	state: string;
	zipCode: string;
	rent: number | null;
	bedrooms: number | null;
	bathrooms: number | null;
	propertyType: string | null;
	daysOnMarket: number | null;
	contactName: string | null;
}

/** The raw outreach form values (strings as typed; validated separately by the form). */
export interface RenterOutreachForm {
	moveInDate: string;
	occupants: string;
	pets: 'none' | 'yes';
	petDescription: string;
	topics: { availability: boolean; pets: boolean; fees: boolean; lease: boolean };
	extraQuestion: string;
}

export interface RenterOutreachInputs {
	listing: RenterOutreachListing;
	moveInDate: string | null;
	/** Whole number 1-12, or null when the form value is not one. */
	occupants: number | null;
	pets: { has: false } | { has: true; description: string };
	topics: RenterOutreachForm['topics'];
	extraQuestion: string;
}

function parseOccupants(raw: string): number | null {
	const s = raw.trim();
	if (!/^\d+$/.test(s)) return null;
	const n = Number(s);
	return n >= 1 && n <= MAX_OCCUPANTS ? n : null;
}

/** Maps the form to the minimized prompt inputs. Pure. */
export function buildOutreachInputs(
	listing: RenterOutreachListing,
	form: RenterOutreachForm
): RenterOutreachInputs {
	const moveIn = form.moveInDate.trim();
	return {
		listing: { ...listing },
		moveInDate: moveIn === '' ? null : moveIn,
		occupants: parseOccupants(form.occupants),
		pets:
			form.pets === 'yes'
				? { has: true, description: form.petDescription.trim().slice(0, PET_DESCRIPTION_MAX) }
				: { has: false },
		topics: { ...form.topics },
		extraQuestion: form.extraQuestion.trim().slice(0, EXTRA_QUESTION_MAX)
	};
}

const TOPIC_LINES: Record<keyof RenterOutreachForm['topics'], string> = {
	availability: 'availability and move-in timing',
	pets: 'pet policy and pet fees',
	fees: 'application fees and deposit',
	lease: 'lease length and terms'
};

const usd = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 0
});

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function listingLines(l: RenterOutreachListing): string[] {
	const lines = [`- Address: ${l.streetLine}, ${l.city}, ${l.state} ${l.zipCode}`.trimEnd()];
	if (l.rent !== null) lines.push(`- Rent: ${usd.format(l.rent)} a month`);
	const rooms = [
		l.bedrooms !== null ? plural(l.bedrooms, 'bedroom') : null,
		l.bathrooms !== null ? plural(l.bathrooms, 'bathroom') : null
	].filter((x): x is string => x !== null);
	if (rooms.length > 0) lines.push(`- Size: ${rooms.join(', ')}`);
	if (l.propertyType) lines.push(`- Type: ${l.propertyType}`);
	if (l.daysOnMarket !== null) lines.push(`- Listed: ${plural(l.daysOnMarket, 'day')} on market`);
	return lines;
}

export const renterOutreachV1: PromptDef<RenterOutreachInputs> = {
	id: RENTER_OUTREACH_PROMPT_ID,
	version: 1,
	feature: RENTER_OUTREACH_FEATURE,
	housingCopy: true,
	containsClientData: true,
	maxTokens: 2048,
	build: (i) => {
		const l = i.listing;
		const topics = (Object.keys(TOPIC_LINES) as (keyof typeof TOPIC_LINES)[])
			.filter((k) => i.topics[k])
			.map((k) => `- ${TOPIC_LINES[k]}`);
		const contact = l.contactName?.trim() ?? '';

		const user = [
			`Listing contact: ${contact || 'the listing contact'}`,
			'Listing facts:',
			...listingLines(l),
			'Topics to ask about:',
			...(topics.length > 0 ? topics : ['- availability and move-in timing']),
			...(i.moveInDate ? [`Preferred move-in date: ${i.moveInDate}`] : []),
			...(i.occupants !== null ? [`People who would live there: ${i.occupants}`] : []),
			`Pets: ${i.pets.has ? i.pets.description || 'yes' : 'none'}`,
			...(i.extraQuestion ? [`Also ask: ${i.extraQuestion}`] : [])
		].join('\n');

		return {
			system: `Write a short, polite email from a prospective renter to the listing contact for ${l.streetLine}, ${l.city}, ${l.state}. Ask only about the topics listed. Describe the home, not people. Do not mention or ask about who lives in the area, schools, places of worship, or any personal traits; the only household detail you may state is the number of people who would live there. If pets are listed, ask about the pet policy and pet fees; never refer to an assistance animal as a pet. Never claim the home is open or will be open; ask about it. Do not invent facts about the home. Sign off with {your_name}.`,
			user,
			known: contact ? [{ value: contact, token: 'contact_name', kind: 'name' }] : []
		};
	}
};
