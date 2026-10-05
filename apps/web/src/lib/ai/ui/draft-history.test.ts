// SSR structural tests for Draft history and the artifact status badge (05-14). Components render
// to a string with `svelte/server`; effects and onMount never run, so the `initial` prop stands in
// for the repository load. The pure helpers live in DraftHistory's <script module>.
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import type { AiArtifact, ArtifactRepo } from '$lib/ai/storage/artifacts';
import ArtifactStatusBadge from './ArtifactStatusBadge.svelte';
import DraftHistory, { formatWhen, preview, sourceLine, flagsLine } from './DraftHistory.svelte';

const decode = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
const strip = (h: string) =>
	decode(h.replace(/<!--[\s\S]*?-->/g, '').replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' '));
const text = (h: string) => strip(h).replace(/\s+/g, ' ').trim();
const count = (h: string, re: RegExp) => (h.match(re) ?? []).length;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function html(component: Component<any>, props: Record<string, unknown>): string {
	return render(component, { props }).body;
}

const HASH = 'a'.repeat(64);

function artifact(over: Partial<AiArtifact> & { id: string; createdAt: string }): AiArtifact {
	return {
		updatedAt: over.createdAt,
		schemaVersion: 1,
		feature: 'demo',
		promptId: 'shared/demo@1',
		provider: 'openai',
		model: 'gpt-6.1-sol',
		sample: false,
		inputHash: HASH,
		text: 'Hello, I saw your listing on Maple Street and would like to schedule a viewing.',
		findings: [],
		status: 'draft',
		sentAt: null,
		...over
	} as AiArtifact;
}

const NEWEST = artifact({
	id: 'a3',
	createdAt: '2026-10-05T15:00:00.000Z',
	status: 'sent',
	sentAt: '2026-10-05T16:00:00.000Z',
	provider: 'anthropic',
	model: 'claude-sonnet-5-5'
});
const MIDDLE = artifact({
	id: 'a2',
	createdAt: '2026-10-04T15:00:00.000Z',
	status: 'acknowledged',
	provider: 'fixture',
	model: 'fixture',
	sample: true
});
const OLDEST = artifact({
	id: 'a1',
	createdAt: '2026-10-03T15:00:00.000Z',
	status: 'draft',
	text: 'x'.repeat(200),
	findings: [
		{ phrase: 'young professionals', severity: 'block', entryIds: ['age-young'] },
		{ phrase: 'church', severity: 'warn', entryIds: ['religion-church'] }
	]
});

const repo: ArtifactRepo = {
	create: () => Promise.reject(new Error('unused')),
	updateText: () => Promise.resolve(),
	setStatus: () => Promise.resolve(),
	get: () => Promise.resolve(undefined),
	listByFeature: () => Promise.resolve([]),
	countByFeature: () => Promise.resolve(0),
	listBySubject: () => Promise.resolve([]),
	countBySubject: () => Promise.resolve(0),
	softDelete: () => Promise.resolve()
};

const base = { feature: 'demo', repo, headingLevel: 3, onOpen: () => {} };

describe('ArtifactStatusBadge', () => {
	test.each([
		['draft', 'Draft'],
		['acknowledged', 'Reviewed'],
		['sent', 'Marked as sent']
	])('%s renders %s with an aria-hidden icon', (status, label) => {
		const body = html(ArtifactStatusBadge, { status });
		expect(text(body)).toBe(label);
		expect(body).toMatch(/<svg[^>]*aria-hidden="true"/);
	});
});

describe('helpers', () => {
	test('formatWhen: same local day reads Today at …', () => {
		const now = new Date(2026, 9, 5, 18, 0);
		const iso = new Date(2026, 9, 5, 15, 42).toISOString();
		expect(formatWhen(iso, now)).toBe('Today at 3:42 PM');
	});

	test('formatWhen: another day reads Mon D at …', () => {
		const now = new Date(2026, 9, 5, 18, 0);
		const iso = new Date(2026, 9, 2, 9, 10).toISOString();
		expect(formatWhen(iso, now)).toBe('Oct 2 at 9:10 AM');
	});

	test('formatWhen: same day of a different year is not Today', () => {
		const now = new Date(2026, 9, 5, 18, 0);
		const iso = new Date(2025, 9, 5, 9, 10).toISOString();
		expect(formatWhen(iso, now)).toBe('Oct 5 at 9:10 AM');
	});

	test('preview: first 120 characters plus an ellipsis when longer', () => {
		expect(preview('x'.repeat(200))).toBe(`${'x'.repeat(120)}…`);
		expect(preview('x'.repeat(120))).toBe('x'.repeat(120));
		expect(preview('Short text.')).toBe('Short text.');
	});

	test('sourceLine and flagsLine', () => {
		expect(sourceLine(NEWEST)).toBe('Anthropic · claude-sonnet-5-5');
		expect(sourceLine(MIDDLE)).toBe('Sample output');
		expect(flagsLine(2)).toBe('2 Fair Housing flags when generated');
		expect(flagsLine(1)).toBe('1 Fair Housing flag when generated');
	});
});

describe('DraftHistory', () => {
	const props = {
		...base,
		initial: { artifacts: [NEWEST, MIDDLE, OLDEST], count: 3 }
	};

	test('title, count and legend', () => {
		const body = html(DraftHistory, props);
		const t = text(body);
		expect(body).toMatch(/<h3[^>]*tabindex="-1"/);
		expect(t).toContain('Draft history');
		expect(t).toContain('3 saved in this browser');
		expect(t).toContain(
			"Reviewed means it passed the Fair Housing check and you copied it or opened it in your email app. Marked as sent is your own note; Tran doesn't send or track email."
		);
	});

	test('headingLevel 4 renders an h4', () => {
		const body = html(DraftHistory, { ...props, headingLevel: 4 });
		expect(body).toMatch(/<h4[^>]*tabindex="-1"/);
		expect(body).not.toMatch(/<h3\b/);
	});

	test('rows newest first with their badges, sources and flags', () => {
		const body = html(DraftHistory, props);
		const rows = [...body.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatch(/^Marked as sent/);
		expect(rows[0]).toContain('Anthropic · claude-sonnet-5-5');
		expect(rows[1]).toMatch(/^Reviewed/);
		expect(rows[1]).toContain('Sample output');
		expect(rows[2]).toMatch(/^Draft/);
		expect(rows[2]).toContain('2 Fair Housing flags when generated');
		expect(rows[2]).toContain(`${'x'.repeat(120)}…`);
		expect(rows[0]).not.toContain('Fair Housing flags');
	});

	test('Open and Delete on every row; Mark as not sent only on the sent row', () => {
		const body = html(DraftHistory, props);
		const rows = [...body.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
		for (const r of rows) {
			expect(r).toContain('Open');
			expect(r).toContain('Delete');
		}
		expect(rows[0]).toContain('Mark as not sent');
		expect(rows[1]).not.toContain('Mark as not sent');
		expect(rows[2]).not.toContain('Mark as not sent');
		expect(count(body, /Mark as not sent/g)).toBe(1);
	});

	test('buttons are 44px minimum', () => {
		const body = html(DraftHistory, props);
		const buttons = [...body.matchAll(/<button\b[^>]*class="([^"]*)"/g)].map((m) => m[1]);
		expect(buttons.length).toBeGreaterThanOrEqual(7);
		for (const c of buttons) expect(c).toMatch(/\b(h-12|min-h-11|size-11)\b/);
	});

	test('Show older drafts only when more drafts exist than are shown', () => {
		expect(text(html(DraftHistory, props))).not.toContain('Show older drafts');
		const more = html(DraftHistory, {
			...base,
			initial: { artifacts: [NEWEST, MIDDLE, OLDEST], count: 14 }
		});
		expect(text(more)).toContain('Show older drafts');
		expect(text(more)).toContain('14 saved in this browser');
	});

	test('empty state', () => {
		const body = html(DraftHistory, { ...base, initial: { artifacts: [], count: 0 } });
		expect(text(body)).toContain(
			'No drafts yet. Each draft you generate here is saved in this browser and included in your backups.'
		);
		expect(body).not.toMatch(/<li\b/);
	});

	test('without initial data the prerendered list waits for the browser', () => {
		const body = html(DraftHistory, base);
		expect(text(body)).toContain('Draft history');
		expect(text(body)).toContain('Checking this browser…');
		expect(text(body)).not.toContain('No drafts yet');
	});
});
