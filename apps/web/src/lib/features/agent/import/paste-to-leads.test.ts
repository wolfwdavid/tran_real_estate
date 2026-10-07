// Paste import glue (08-20, AGT-03): TRAN-LEAD blocks first, free-form fallback, exact modes.
import { describe, expect, it } from 'vitest';
import {
	CLEAN_BLOCK,
	MANGLED,
	TWO_BLOCKS,
	V2_THEN_V1
} from '@tran/core/leads/fixtures/mangled-blocks';
import { MAX_PASTE_CHARS, pasteToLeads } from './paste-to-leads';

const ONLY_V2 = [
	'TRAN-LEAD v2',
	'fullName: Someone From The Future',
	'email: future@example.com',
	'END TRAN-LEAD'
].join('\n');

describe('pasteToLeads', () => {
	it('turns two valid blocks into two inquiry leads with the message kept', () => {
		const r = pasteToLeads(TWO_BLOCKS);
		expect(r.mode).toBe('blocks');
		expect(r.newerVersion).toBe(0);
		expect(r.invalid).toBe(0);
		expect(r.leads).toHaveLength(2);
		expect(r.leads[0]).toEqual({
			rowNumber: 1,
			name: 'Jordan Example',
			email: 'jordan@example.com',
			phone: '(555) 555-0142',
			propertyOfInterest: '12 Sample Lane, Harlow Springs',
			notes: '',
			source: 'inquiry',
			consentSource: 'inquiry-form',
			message: 'Could we tour Saturday?\nSecond line of the message.'
		});
		expect(r.leads[1]).toMatchObject({
			rowNumber: 2,
			name: 'Riley Sample',
			email: 'riley@example.com',
			phone: '555-555-0107',
			propertyOfInterest: '',
			source: 'inquiry',
			consentSource: 'unknown',
			message: 'Is the condo still available?'
		});
	});

	it('reads every mangled fixture shape', () => {
		for (const f of MANGLED) {
			const r = pasteToLeads(f.text);
			expect(r.mode, f.label).toBe('blocks');
			expect(r.leads, f.label).toHaveLength(1);
			expect(r.leads[0]?.email, f.label).toBe('jordan@example.com');
			expect(r.leads[0]?.name, f.label).toBe('Jordan Example');
		}
	});

	it('skips a newer-version block but keeps the v1 block next to it', () => {
		const r = pasteToLeads(V2_THEN_V1);
		expect(r.mode).toBe('blocks');
		expect(r.leads).toHaveLength(1);
		expect(r.leads[0]?.name).toBe('Jordan Example');
		expect(r.newerVersion).toBe(1);
	});

	it('reports mode none with the newer-version count when only v2 blocks are present', () => {
		const r = pasteToLeads(ONLY_V2);
		expect(r).toEqual({ mode: 'none', leads: [], newerVersion: 1, invalid: 0 });
	});

	it('counts an invalid block (bad email) and skips it', () => {
		const bad = CLEAN_BLOCK.replace('email: jordan@example.com', 'email: not-an-email');
		const r = pasteToLeads(`${bad}\n\n${CLEAN_BLOCK}`);
		expect(r.mode).toBe('blocks');
		expect(r.invalid).toBe(1);
		expect(r.leads).toHaveLength(1);
		expect(r.leads[0]?.rowNumber).toBe(1);
	});

	it('falls back to free-form when there is no block', () => {
		const r = pasteToLeads(
			'From: "Casey Free" <casey.free@example.com>\nHi, call me at 555-555-0132'
		);
		expect(r.mode).toBe('freeform');
		expect(r.newerVersion).toBe(0);
		expect(r.invalid).toBe(0);
		expect(r.leads).toEqual([
			{
				rowNumber: 1,
				name: 'Casey Free',
				email: 'casey.free@example.com',
				phone: '(555) 555-0132',
				propertyOfInterest: '',
				notes: '',
				source: 'paste',
				consentSource: 'unknown'
			}
		]);
	});

	it('reports none when nothing lead-like is found', () => {
		expect(pasteToLeads('hello there')).toEqual({
			mode: 'none',
			leads: [],
			newerVersion: 0,
			invalid: 0
		});
	});

	it('reports empty for blank input', () => {
		expect(pasteToLeads('').mode).toBe('empty');
		expect(pasteToLeads('  \n\t ').mode).toBe('empty');
	});

	it('reports too-long over the paste cap without parsing', () => {
		expect(MAX_PASTE_CHARS).toBe(100_000);
		const r = pasteToLeads('a'.repeat(MAX_PASTE_CHARS + 1));
		expect(r).toEqual({ mode: 'too-long', leads: [], newerVersion: 0, invalid: 0 });
		expect(pasteToLeads('a'.repeat(MAX_PASTE_CHARS)).mode).toBe('none');
	});
});
