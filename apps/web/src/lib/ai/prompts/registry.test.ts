import { describe, expect, it } from 'vitest';
import { checkFairHousing } from '@tran/core/fair-housing';
import { HOUSING_COPY_GUARDRAIL } from './guardrail.js';
import { sha256Hex } from './hash.js';
import { buildPrompt, getPrompt, registerPrompt } from './registry.js';
import { DEMO_INPUTS } from './shared/demo.v1.js';
import type { PromptDef } from './types.js';

describe('sha256Hex', () => {
	it('matches the FIPS 180-2 "abc" vector', async () => {
		expect(await sha256Hex('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});
});

describe('HOUSING_COPY_GUARDRAIL', () => {
	it('is versioned and itself Fair Housing clean', () => {
		expect(HOUSING_COPY_GUARDRAIL.id).toBe('guardrail.property-not-people');
		expect(HOUSING_COPY_GUARDRAIL.version).toBe(1);
		expect(HOUSING_COPY_GUARDRAIL.text.startsWith('Describe the property, not the people.')).toBe(
			true
		);
		expect(checkFairHousing(HOUSING_COPY_GUARDRAIL.text)).toEqual([]);
	});
});

describe('getPrompt', () => {
	it('returns the generic demo prompt', () => {
		const def = getPrompt('shared/demo');
		expect(def.id).toBe('shared/demo');
		expect(def.version).toBe(1);
		expect(def.feature).toBe('demo');
		expect(def.housingCopy).toBe(true);
		expect(def.containsClientData).toBe(true);
		expect(def.maxTokens).toBe(2048);
	});

	it('throws on an unknown id', () => {
		expect(() => getPrompt('nope')).toThrow('Unknown prompt: nope');
	});
});

describe('buildPrompt', () => {
	it('prepends the guardrail to housing copy and sets the promptId', async () => {
		const built = await buildPrompt('shared/demo', DEMO_INPUTS);
		const def = getPrompt('shared/demo');
		const raw = def.build(DEMO_INPUTS);
		expect(built.system).toBe(`${HOUSING_COPY_GUARDRAIL.text}\n\n${raw.system}`);
		expect(built.promptId).toBe('shared/demo@1');
		expect(built.id).toBe('shared/demo');
		expect(built.version).toBe(1);
		expect(built.feature).toBe('demo');
		expect(built.containsClientData).toBe(true);
		expect(built.maxTokens).toBe(2048);
	});

	it('replaces client name, email and phone with role tokens before send', async () => {
		const built = await buildPrompt('shared/demo', DEMO_INPUTS);
		expect(built.user).toContain('{client_name}');
		expect(built.user).toContain('{client_email}');
		expect(built.user).toContain('{client_phone}');
		for (const raw of ['Jordan Rivera', 'jordan.rivera@example.com', '(212) 555-0147']) {
			expect(built.user).not.toContain(raw);
			expect(built.system).not.toContain(raw);
		}
		expect(built.redactions).toHaveLength(3);
		expect(built.redactions.map((r) => r.original).sort()).toEqual(
			['(212) 555-0147', 'Jordan Rivera', 'jordan.rivera@example.com'].sort()
		);
		expect(built.user).toContain('18 Example Lane');
	});

	it('never stores the raw inputs on the result', async () => {
		const built = await buildPrompt('shared/demo', DEMO_INPUTS);
		expect(Object.keys(built).sort()).toEqual(
			[
				'containsClientData',
				'feature',
				'id',
				'inputHash',
				'maxTokens',
				'promptId',
				'redactions',
				'system',
				'user',
				'version'
			].sort()
		);
	});

	it('hashes exactly the redacted payload, reproducibly', async () => {
		const a = await buildPrompt('shared/demo', DEMO_INPUTS);
		const b = await buildPrompt('shared/demo', { ...DEMO_INPUTS });
		expect(a.inputHash).toMatch(/^[0-9a-f]{64}$/);
		expect(a.inputHash).toBe(await sha256Hex(`${a.system}\n\n${a.user}`));
		expect(b.inputHash).toBe(a.inputHash);

		const c = await buildPrompt('shared/demo', {
			...DEMO_INPUTS,
			listing: `${DEMO_INPUTS.listing} Dishwasher included.`
		});
		expect(c.inputHash).not.toBe(a.inputHash);
	});

	it('does not prefix the guardrail when housingCopy is false', async () => {
		const def: PromptDef<{ topic: string }> = {
			id: 'test/plain',
			version: 1,
			feature: 'test',
			housingCopy: false,
			containsClientData: false,
			maxTokens: 2048,
			build: (i) => ({ system: 'Summarize.', user: `Topic: ${i.topic}`, known: [] })
		};
		registerPrompt(def as PromptDef);
		const built = await buildPrompt('test/plain', { topic: 'lease terms' });
		expect(built.system).toBe('Summarize.');
		expect(built.system).not.toContain(HOUSING_COPY_GUARDRAIL.text);
		expect(built.promptId).toBe('test/plain@1');
		expect(built.redactions).toEqual([]);
	});

	it('refuses to silently override an already registered id + version', () => {
		const def = getPrompt('shared/demo');
		expect(() => registerPrompt({ ...def })).toThrow();
		expect(getPrompt('shared/demo')).toBe(def);
	});
});

describe('PromptDef.sample (fixture text)', () => {
	const base: PromptDef<{ topic: string }> = {
		id: 'test/sampled',
		version: 1,
		feature: 'test',
		housingCopy: false,
		containsClientData: false,
		maxTokens: 2048,
		build: (i) => ({ system: 'Summarize.', user: `Topic: ${i.topic}`, known: [] })
	};

	it('sets fixtureText from sample(inputs); inputHash ignores it', async () => {
		registerPrompt({ ...base, sample: (i) => `Sample about ${i.topic}.` } as PromptDef);
		const built = await buildPrompt('test/sampled', { topic: 'leases' });
		expect(built.fixtureText).toBe('Sample about leases.');
		registerPrompt({ ...base, version: 2 } as PromptDef);
		const plain = await buildPrompt('test/sampled', { topic: 'leases' });
		expect(plain).not.toHaveProperty('fixtureText');
		expect(plain.inputHash).toBe(built.inputHash);
	});
});
