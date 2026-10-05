// Real-browser checks for the 05-14 Settings controls and Draft history: axe on every state the
// UI-SPEC lists for them, plus the focus rules SSR cannot exercise (Use default keeps focus on the
// field; a confirmed delete moves focus to the Draft history title).
import { afterEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { LiveProviderId } from '@tran/core/ai';
import { axeViolations } from '$lib/testing/axe';
import { AI_PREF_KEYS, aiPrefs } from '$lib/ai/prefs.svelte';
import type { AiArtifact, ArtifactRepo, ArtifactStatus } from '$lib/ai/storage/artifacts';
import type { AiKeyState } from '$lib/ai/setup';
import AiModelField from './AiModelField.svelte';
import AiProviderPicker from './AiProviderPicker.svelte';
import DraftHistory from './DraftHistory.svelte';
import SampleOutputToggle from './SampleOutputToggle.svelte';
import TestConnectionResult from './TestConnectionResult.svelte';

afterEach(() => {
	for (const k of Object.values(AI_PREF_KEYS)) localStorage.removeItem(k);
});

const states =
	(m: Partial<Record<LiveProviderId, AiKeyState>>) =>
	(id: LiveProviderId): AiKeyState =>
		m[id] ?? 'none';

describe('AiProviderPicker', () => {
	test('no keys: axe clean; choosing a provider persists it', async () => {
		const onChange = vi.fn();
		const { container } = await render(AiProviderPicker, {
			props: { keyState: states({}), selected: null, onChange }
		});
		expect(await axeViolations(container)).toEqual([]);
		const radios = container.querySelectorAll<HTMLElement>('[role="radio"]');
		expect(radios).toHaveLength(4);
		await userEvent.click(radios[1]);
		await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('openai'));
		expect(aiPrefs.provider).toBe('openai');
	});

	test('saved and locked keys: axe clean, default checked', async () => {
		const { container } = await render(AiProviderPicker, {
			props: { keyState: states({ openai: 'saved', gemini: 'locked' }), selected: null }
		});
		expect(
			container.querySelector('[role="radio"][aria-checked="true"]')?.getAttribute('data-value')
		).toBe('openai');
		expect(await axeViolations(container)).toEqual([]);
	});
});

describe('SampleOutputToggle', () => {
	test('axe clean; toggling writes the pref', async () => {
		const { container } = await render(SampleOutputToggle, {
			props: { checked: false, providerLabel: 'Anthropic' }
		});
		expect(await axeViolations(container)).toEqual([]);
		await userEvent.click(container.querySelector<HTMLElement>('[role="checkbox"]')!);
		await vi.waitFor(() => expect(aiPrefs.sample).toBe(true));
	});
});

describe('AiModelField', () => {
	test('invalid value shows a linked error and stays axe clean', async () => {
		const onSave = vi.fn();
		const { container } = await render(AiModelField, {
			props: { provider: 'openai', value: 'gpt-6.1-sol', onSave }
		});
		const input = container.querySelector<HTMLInputElement>('input')!;
		await userEvent.clear(input);
		await userEvent.type(input, 'gpt 5{Enter}');
		await vi.waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
		const describedBy = input.getAttribute('aria-describedby')!.split(' ');
		const error = document.getElementById(describedBy[1])!;
		expect(error.textContent).toContain("Model names don't contain spaces.");
		expect(onSave).not.toHaveBeenCalled();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('a valid change saves on Enter; Use default resets and keeps focus on the field', async () => {
		const onSave = vi.fn();
		const { container, rerender } = await render(AiModelField, {
			props: { provider: 'openai', value: 'gpt-6.1-sol', onSave }
		});
		const input = container.querySelector<HTMLInputElement>('input')!;
		await userEvent.clear(input);
		await userEvent.type(input, 'gpt-5.6-terra{Enter}');
		expect(onSave).toHaveBeenLastCalledWith('gpt-5.6-terra');
		await rerender({ provider: 'openai', value: 'gpt-5.6-terra', onSave });
		const useDefault = [...container.querySelectorAll('button')].find(
			(b) => b.textContent?.trim() === 'Use default'
		)!;
		await userEvent.click(useDefault);
		expect(onSave).toHaveBeenLastCalledWith(null);
		await rerender({ provider: 'openai', value: 'gpt-6.1-sol', onSave });
		await vi.waitFor(() => expect(document.activeElement).toBe(input));
		expect(input.value).toBe('gpt-6.1-sol');
	});
});

describe('TestConnectionResult', () => {
	test.each([
		[{ outcome: 'ok', modelListed: true }],
		[{ outcome: 'ok', modelListed: false }],
		[{ outcome: 'cors-blocked' }],
		[{ outcome: 'auth' }],
		[{ outcome: 'quota' }],
		[{ outcome: 'network' }]
	])('%o is axe clean', async (result) => {
		const { container } = await render(TestConnectionResult, {
			props: { provider: 'anthropic', model: 'claude-sonnet-5-5', result, testing: false }
		});
		expect(container.textContent?.trim()).not.toBe('');
		expect(await axeViolations(container)).toEqual([]);
	});
});

function memoryRepo(rows: AiArtifact[]): ArtifactRepo & { rows: AiArtifact[] } {
	const live = () =>
		rows
			.filter((a) => a.deletedAt === undefined)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	return {
		rows,
		create: () => Promise.reject(new Error('unused')),
		updateText: () => Promise.resolve(),
		async setStatus(id: string, status: ArtifactStatus) {
			const a = rows.find((x) => x.id === id);
			if (a) a.status = status;
		},
		get: async (id) => rows.find((x) => x.id === id),
		listByFeature: async (_f, o = {}) =>
			live().slice(o.offset ?? 0, (o.offset ?? 0) + (o.limit ?? 10)),
		countByFeature: async () => live().length,
		async softDelete(id, at) {
			const a = rows.find((x) => x.id === id);
			if (a) a.deletedAt = at.toISOString();
		}
	};
}

function artifact(id: string, createdAt: string, status: ArtifactStatus): AiArtifact {
	return {
		id,
		createdAt,
		updatedAt: createdAt,
		schemaVersion: 1,
		feature: 'demo',
		promptId: 'shared/demo@1',
		provider: 'openai',
		model: 'gpt-6.1-sol',
		sample: false,
		inputHash: 'a'.repeat(64),
		text: `Draft ${id} about a fictional listing.`,
		findings: [],
		status,
		sentAt: status === 'sent' ? createdAt : null
	} as AiArtifact;
}

describe('DraftHistory', () => {
	const seed = () => [
		artifact('a1', '2026-10-03T15:00:00.000Z', 'draft'),
		artifact('a2', '2026-10-04T15:00:00.000Z', 'acknowledged'),
		artifact('a3', '2026-10-05T15:00:00.000Z', 'sent')
	];

	test('all three statuses: axe clean; Mark as not sent updates the row', async () => {
		const repo = memoryRepo(seed());
		const { container } = await render(DraftHistory, {
			props: { feature: 'demo', repo, headingLevel: 3, onOpen: () => {} }
		});
		await vi.waitFor(() => expect(container.querySelectorAll('li')).toHaveLength(3));
		expect(await axeViolations(container)).toEqual([]);
		const notSent = [...container.querySelectorAll('button')].find(
			(b) => b.textContent?.trim() === 'Mark as not sent'
		)!;
		await userEvent.click(notSent);
		await vi.waitFor(() =>
			expect(repo.rows.find((a) => a.id === 'a3')?.status).toBe('acknowledged')
		);
		await vi.waitFor(() => expect(container.textContent).not.toContain('Mark as not sent'));
	});

	test('delete confirm: axe clean while open; confirming focuses the title', async () => {
		const repo = memoryRepo(seed());
		const { container } = await render(DraftHistory, {
			props: { feature: 'demo', repo, headingLevel: 3, onOpen: () => {} }
		});
		await vi.waitFor(() => expect(container.querySelectorAll('li')).toHaveLength(3));
		const del = [...container.querySelectorAll('li')[0].querySelectorAll('button')].find(
			(b) => b.textContent?.trim() === 'Delete'
		)!;
		await userEvent.click(del);
		await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull());
		const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]')!;
		expect(dialog.textContent).toContain('Delete this draft?');
		await vi.waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('Keep draft'));
		expect(await axeViolations(document.body)).toEqual([]);

		const confirm = [...dialog.querySelectorAll('button')].find(
			(b) => b.textContent?.trim() === 'Delete draft'
		)!;
		await userEvent.click(confirm);
		await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull());
		const title = container.querySelector('h3')!;
		await vi.waitFor(() => expect(document.activeElement).toBe(title));
		await vi.waitFor(() => expect(container.querySelectorAll('li')).toHaveLength(2));
		expect(repo.rows.find((a) => a.id === 'a3')?.deletedAt).toBeDefined();
		expect(container.textContent).toContain('2 saved in this browser');
	});

	test('Show older drafts loads the next page', async () => {
		const rows = Array.from({ length: 12 }, (_, i) =>
			artifact(`b${i}`, new Date(Date.UTC(2026, 8, 1 + i)).toISOString(), 'draft')
		);
		const repo = memoryRepo(rows);
		const { container } = await render(DraftHistory, {
			props: { feature: 'demo', repo, headingLevel: 4, onOpen: () => {} }
		});
		await vi.waitFor(() => expect(container.querySelectorAll('li')).toHaveLength(10));
		const more = [...container.querySelectorAll('button')].find(
			(b) => b.textContent?.trim() === 'Show older drafts'
		)!;
		await userEvent.click(more);
		await vi.waitFor(() => expect(container.querySelectorAll('li')).toHaveLength(12));
		expect(container.textContent).not.toContain('Show older drafts');
	});
});
