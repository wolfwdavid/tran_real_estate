/**
 * Investment memo (INV-06): a short plain-text memo about one saved deal.
 *
 * FACTS in, narration out. The model receives ONLY the pre-formatted FACTS text (analyzer outputs
 * and inputs as display strings, built by @tran/core/finance buildMemoFacts) and the user's notes.
 * It never sees raw floats or any other field, so it has nothing to compute with; the memo's
 * numbers post-check then holds every numeral to the same FACTS text. `facts` rides along only for
 * the keyless sample memo and is never read by `build`.
 */
import { sampleMemo, type MemoFacts } from '@tran/core/finance';
import type { PromptDef } from '../types.js';

export const INVESTOR_MEMO_PROMPT_ID = 'investor/memo.v1';
export const INVESTOR_MEMO_FEATURE = 'investor-memo';

export interface InvestorMemoInputs {
	factsText: string;
	notes: string;
	facts: MemoFacts;
}

export const INVESTOR_MEMO_SYSTEM =
	"You write a short memo about one rental property for the person who analyzed it. Use only numbers that appear in FACTS or NOTES, copied exactly as written. Do not calculate, round, sum, convert, annualize, or estimate any new number. Write numbers as digits. Do not describe the neighborhood, its residents, schools, safety, or who the property suits. Do not recommend buying or selling, and do not predict returns or price changes. Use 'estimated' for estimates, and 'based on N comparables' where FACTS gives N. Write plain text in 4 to 6 short paragraphs.";

export const investorMemoV1: PromptDef<InvestorMemoInputs> = {
	id: INVESTOR_MEMO_PROMPT_ID,
	version: 1,
	feature: INVESTOR_MEMO_FEATURE,
	housingCopy: true,
	containsClientData: false,
	maxTokens: 2048,
	build: (i) => {
		const notes = i.notes.trim();
		return {
			system: INVESTOR_MEMO_SYSTEM,
			user: `FACTS:\n${i.factsText}\n\nNOTES FROM THE USER:\n${notes || '(none)'}`,
			known: []
		};
	},
	sample: (i) => sampleMemo(i.facts)
};
