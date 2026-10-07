/**
 * Versioned prompt registry. `buildPrompt` is the only way a prompt reaches a provider:
 * it prepends the property-not-people guardrail to housing copy, replaces declared client PII
 * (and any stray emails/phones) with role tokens, and hashes exactly what will be sent.
 */
import { redactPii } from '@tran/core/privacy';
import { HOUSING_COPY_GUARDRAIL } from './guardrail.js';
import { sha256Hex } from './hash.js';
import { investorMemoV1 } from './investor/memo.v1.js';
import { renterOutreachV1 } from './renter/outreach.v1.js';
import { demoV1 } from './shared/demo.v1.js';
import { studioListingV1 } from './studio/listing.v1.js';
import { studioSnapshotV1 } from './studio/snapshot.v1.js';
import type { BuiltPrompt, PromptDef } from './types.js';

const prompts = new Map<string, PromptDef>();

/** Registers a prompt. Re-registering the same id + version throws (no silent override). */
export function registerPrompt(def: PromptDef): void {
	const existing = prompts.get(def.id);
	if (existing && existing.version === def.version) {
		throw new Error(`Prompt already registered: ${def.id}@${def.version}`);
	}
	prompts.set(def.id, def);
}

export function getPrompt(id: string): PromptDef {
	const def = prompts.get(id);
	if (!def) throw new Error('Unknown prompt: ' + id);
	return def;
}

export async function buildPrompt(id: string, inputs: unknown): Promise<BuiltPrompt> {
	const def = getPrompt(id);
	const b = def.build(inputs);
	const system = def.housingCopy ? `${HOUSING_COPY_GUARDRAIL.text}\n\n${b.system}` : b.system;
	const { text: user, redactions } = redactPii(b.user, b.known);
	const inputHash = await sha256Hex(`${system}\n\n${user}`);
	// Fixture-provider sample only: not part of the sent payload, so not hashed.
	const fixtureText = def.sample?.(inputs);
	return {
		id: def.id,
		version: def.version,
		promptId: `${def.id}@${def.version}`,
		feature: def.feature,
		system,
		user,
		redactions,
		containsClientData: def.containsClientData,
		maxTokens: def.maxTokens,
		inputHash,
		...(fixtureText !== undefined ? { fixtureText } : {})
	};
}

registerPrompt(demoV1 as PromptDef);
// Phase 6: renter/outreach.v1 (RENT-07).
registerPrompt(renterOutreachV1 as PromptDef);
// Phase 7: investor/memo.v1 (INV-06).
registerPrompt(investorMemoV1 as PromptDef);
// Phase 9: studio/listing.v1 (STU-01) and studio/snapshot.v1 market notes (STU-04).
registerPrompt(studioListingV1 as PromptDef);
registerPrompt(studioSnapshotV1 as PromptDef);
