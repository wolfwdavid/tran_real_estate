import { describe, expect, it } from 'vitest';
import { SETTINGS_SECTIONS, availableSections } from './sections';

describe('settings section registry', () => {
	it('keeps the fixed cross-phase order of ids', () => {
		expect(SETTINGS_SECTIONS.map((s) => s.id)).toEqual([
			'api-keys',
			'rentcast-usage',
			'ai-drafting',
			'key-security',
			'backup',
			'storage',
			'install',
			'getting-started'
		]);
	});

	it('keeps the fixed cross-phase order of labels', () => {
		expect(SETTINGS_SECTIONS.map((s) => s.label)).toEqual([
			'API keys',
			'RentCast usage',
			'AI drafting',
			'Key security',
			'Backup and restore',
			'Storage',
			'Install the app',
			'Getting started'
		]);
	});

	it('assigns each slot to its owning phase', () => {
		expect(SETTINGS_SECTIONS.map((s) => s.owner)).toEqual([3, 4, 5, 3, 3, 3, 3, 10]);
	});

	it('marks every section available once Phase 10 ships Getting started', () => {
		for (const s of SETTINGS_SECTIONS) expect(s.available).toBe(true);
	});

	it('has unique, anchor-safe ids', () => {
		const ids = SETTINGS_SECTIONS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id).toMatch(/^[a-z-]+$/);
	});

	it('availableSections() returns the eight shipped sections in registry order', () => {
		expect(availableSections().map((s) => s.id)).toEqual([
			'api-keys',
			'rentcast-usage',
			'ai-drafting',
			'key-security',
			'backup',
			'storage',
			'install',
			'getting-started'
		]);
	});

	it('is frozen', () => {
		expect(Object.isFrozen(SETTINGS_SECTIONS)).toBe(true);
	});
});
