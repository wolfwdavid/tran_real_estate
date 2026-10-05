import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { announcerMessage } from '$lib/components/a11y/announcer.svelte';
import { axeViolations } from '$lib/testing/axe';
import ProvenanceChip from './ProvenanceChip.svelte';
import ProvenanceRow from './ProvenanceRow.svelte';
import { REFRESH_DONE } from './copy/provenance';
import { toIso } from './relative-time';
import { findUnbadgedSampleCards } from './sample-chip-check';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const TWO_HOURS_AGO = NOW - 2 * 60 * 60 * 1000;

const sample = { source: 'sample', fetchedAt: NOW, stale: false } as const;
const live = { source: 'rentcast', fetchedAt: TWO_HOURS_AGO, stale: false } as const;
const stale = { source: 'rentcast', fetchedAt: TWO_HOURS_AGO, stale: true } as const;

function chipIn(container: HTMLElement): HTMLElement {
	const chip = container.querySelector<HTMLElement>('[data-provenance-chip]');
	if (!chip) throw new Error('no chip rendered');
	return chip;
}

describe('ProvenanceChip', () => {
	test('sample: "Sample data", terracotta tint with a strong outline and a hidden icon', async () => {
		const { container } = await render(ProvenanceChip, { props: { provenance: sample, now: NOW } });
		const chip = chipIn(container);
		expect(chip.tagName).toBe('SPAN');
		expect(chip.dataset.provenanceChip).toBe('sample');
		expect(chip.textContent?.trim()).toBe('Sample data');
		expect(chip.classList).toContain('bg-accent-surface');
		expect(chip.classList).toContain('border-border-strong');
		expect(chip.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
		expect(chip.querySelector('time')).toBeNull();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('live: "RentCast · as of 2 hours ago" with a <time datetime> of the original fetch', async () => {
		const { container } = await render(ProvenanceChip, { props: { provenance: live, now: NOW } });
		const chip = chipIn(container);
		expect(chip.dataset.provenanceChip).toBe('live');
		expect(chip.textContent?.replace(/\s+/g, ' ').trim()).toBe('RentCast · as of 2 hours ago');
		const time = chip.querySelector('time');
		expect(time?.getAttribute('datetime')).toBe(toIso(TWO_HOURS_AGO));
		expect(time?.getAttribute('aria-live')).toBe('off');
		expect(chip.classList).toContain('bg-secondary-surface');
		expect(chip.classList).toContain('text-secondary');
		expect(chip.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('stale: adds "· may be out of date" on the neutral surface', async () => {
		const { container } = await render(ProvenanceChip, { props: { provenance: stale, now: NOW } });
		const chip = chipIn(container);
		expect(chip.dataset.provenanceChip).toBe('stale');
		const text = chip.textContent?.replace(/\s+/g, ' ').trim();
		expect(text).toBe('RentCast · as of 2 hours ago · may be out of date');
		expect(text?.endsWith('· may be out of date')).toBe(true);
		expect(chip.classList).toContain('bg-surface');
		expect(chip.querySelector('time')?.getAttribute('datetime')).toBe(toIso(TWO_HOURS_AGO));
		expect(chip.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
		expect(await axeViolations(container)).toEqual([]);
	});

	test('without a `now` prop the chip reads the clock itself', async () => {
		const { container } = await render(ProvenanceChip, {
			props: { provenance: { source: 'rentcast', fetchedAt: Date.now(), stale: false } }
		});
		expect(chipIn(container).textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'RentCast · as of just now'
		);
	});
});

describe('ProvenanceRow', () => {
	test('live with onRefresh offers "Refresh (1 call)", busy while running, announces when done', async () => {
		let resolve!: () => void;
		const onRefresh = vi.fn(
			() =>
				new Promise<void>((r) => {
					resolve = r;
				})
		);
		const { container } = await render(ProvenanceRow, {
			props: { provenance: live, onRefresh, now: NOW }
		});
		const refresh = page.getByRole('button', { name: 'Refresh (1 call)' });
		await expect.element(refresh).toBeVisible();
		expect(container.querySelector('button svg[aria-hidden="true"]')).not.toBeNull();
		expect(await axeViolations(container)).toEqual([]);

		await refresh.click();
		expect(onRefresh).toHaveBeenCalledTimes(1);
		const busy = page.getByRole('button', { name: 'Refreshing…' });
		await expect.element(busy).toBeDisabled();
		expect(container.querySelector('button svg[class~="motion-safe:animate-spin"]')).not.toBeNull();
		expect(await axeViolations(container)).toEqual([]);

		resolve();
		await expect.element(page.getByRole('button', { name: 'Refresh (1 call)' })).toBeEnabled();
		await expect.poll(() => announcerMessage()).toBe(REFRESH_DONE);
		expect(onRefresh).toHaveBeenCalledTimes(1);
	});

	test('stale rows offer Refresh too', async () => {
		await render(ProvenanceRow, {
			props: { provenance: stale, onRefresh: async () => {}, now: NOW }
		});
		await expect.element(page.getByRole('button', { name: 'Refresh (1 call)' })).toBeVisible();
	});

	test('sample rows never offer Refresh', async () => {
		const { container } = await render(ProvenanceRow, {
			props: { provenance: sample, onRefresh: async () => {}, now: NOW }
		});
		expect(container.querySelector('button')).toBeNull();
		expect(chipIn(container).textContent?.trim()).toBe('Sample data');
		expect(await axeViolations(container)).toEqual([]);
	});

	test('no onRefresh means no button', async () => {
		const { container } = await render(ProvenanceRow, { props: { provenance: live, now: NOW } });
		expect(container.querySelector('button')).toBeNull();
	});
});

describe('findUnbadgedSampleCards', () => {
	const cards: HTMLElement[] = [];
	afterEach(() => {
		for (const c of cards.splice(0)) c.remove();
	});

	test('returns exactly the sample card that lacks a visible sample chip', async () => {
		const root = document.createElement('div');
		const badged = document.createElement('article');
		badged.dataset.provenance = 'sample';
		const unbadged = document.createElement('article');
		unbadged.dataset.provenance = 'sample';
		const liveCard = document.createElement('article');
		liveCard.dataset.provenance = 'rentcast';
		const hiddenChipCard = document.createElement('article');
		hiddenChipCard.dataset.provenance = 'sample';
		const hiddenChip = document.createElement('span');
		hiddenChip.dataset.provenanceChip = 'sample';
		hiddenChip.style.display = 'none';
		hiddenChipCard.append(hiddenChip);
		root.append(badged, unbadged, liveCard, hiddenChipCard);
		document.body.append(root);
		cards.push(root);

		await render(ProvenanceChip, { props: { provenance: sample, now: NOW }, target: badged });

		expect(findUnbadgedSampleCards(root)).toEqual([unbadged, hiddenChipCard]);
	});
});
