// SSR structural tests for the shared CRM list components (08-17). svelte/server renders each
// component to a string in the node project. resolve() from $app/paths loads under Vitest without
// a mock (base is '' there), so the card's link is asserted as '/agent/contact/?id=...'.
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import type { Contact, Task } from '@tran/core/agent';
import DueBadge from './DueBadge.svelte';
import ContactCard from './ContactCard.svelte';
import SmartListFilter from './SmartListFilter.svelte';

const clean = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (C: any, props: Record<string, unknown> = {}) => clean(render(C, { props }).body);
const text = (h: string) =>
	h
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

const TODAY = '2026-10-04';

const contact = (over: Partial<Contact> = {}): Contact =>
	({
		id: 'c 1',
		createdAt: '2026-09-20T12:00:00.000Z',
		updatedAt: '2026-09-20T12:00:00.000Z',
		name: 'Jordan Example',
		email: 'jordan@example.com',
		phone: '(555) 555-0101',
		stage: 'new',
		stageChangedAt: '2026-09-20T12:00:00.000Z',
		source: 'inquiry',
		propertyOfInterest: '',
		notes: '',
		consentSource: 'inquiry-form',
		emailOptOutAt: null,
		lastContactedAt: null,
		sample: false,
		...over
	}) as Contact;

const task = (over: Partial<Task> = {}): Task =>
	({
		id: 't1',
		createdAt: '2026-09-20T12:00:00.000Z',
		updatedAt: '2026-09-20T12:00:00.000Z',
		contactId: 'c 1',
		title: 'Call back',
		dueDate: TODAY,
		status: 'open',
		doneAt: null,
		sample: false,
		...over
	}) as Task;

describe('DueBadge', () => {
	test('overdue: accent-surface badge, icon, "Overdue · Oct 2"', () => {
		const h = html(DueBadge, { task: task({ dueDate: '2026-10-02' }), today: TODAY });
		expect(text(h)).toBe('Overdue · Oct 2');
		expect(h).toContain('bg-accent-surface');
		expect(h).toMatch(/<svg[^>]*aria-hidden="true"/);
	});
	test('due today: surface badge with icon', () => {
		const h = html(DueBadge, { task: task(), today: TODAY });
		expect(text(h)).toBe('Due today');
		expect(h).toContain('bg-surface');
		expect(h).toMatch(/<svg[^>]*aria-hidden="true"/);
	});
	test('upcoming: muted text, no badge or icon', () => {
		const h = html(DueBadge, { task: task({ dueDate: '2026-10-09' }), today: TODAY });
		expect(text(h)).toBe('Due Oct 9');
		expect(h).toContain('text-muted-foreground');
		expect(h).not.toContain('<svg');
		expect(h).not.toContain('rounded-full');
	});
	test('done or null renders nothing', () => {
		expect(text(html(DueBadge, { task: null, today: TODAY }))).toBe('');
		const done = task({
			status: 'done',
			doneAt: '2026-10-04T10:00:00.000Z',
			dueDate: '2026-10-01'
		});
		expect(text(html(DueBadge, { task: done, today: TODAY }))).toBe('');
	});
});

describe('ContactCard', () => {
	test('article labelled by the name link, href to the detail page', () => {
		const h = html(ContactCard, {
			contact: contact(),
			nextTask: null,
			today: TODAY,
			variant: 'board'
		});
		expect(h).toMatch(/<article[^>]*aria-labelledby="contact-c 1-name"/);
		expect(h).toMatch(/<article[^>]*data-contact-id="c 1"/);
		expect(h).toMatch(/<a[^>]*id="contact-c 1-name"/);
		expect(h).toContain('href="/agent/contact/?id=c%201"');
		expect(h).toContain('>Jordan Example</a>');
		expect(h).not.toMatch(/shadow|hover:-translate|bg-primary/);
	});
	test('Not contacted yet when never contacted; board omits the source', () => {
		const h = html(ContactCard, {
			contact: contact(),
			nextTask: null,
			today: TODAY,
			variant: 'board'
		});
		expect(text(h)).toContain('Not contacted yet');
		expect(text(h)).not.toContain('Inquiry form');
	});
	test('list variant appends the source label', () => {
		const h = html(ContactCard, {
			contact: contact({ lastContactedAt: new Date().toISOString() }),
			nextTask: null,
			today: TODAY,
			variant: 'list'
		});
		expect(text(h)).toMatch(/Last contact today · \S/);
	});
	test('Moving… replaces the meta line while a move is in flight', () => {
		const h = html(ContactCard, {
			contact: contact(),
			nextTask: null,
			today: TODAY,
			variant: 'board',
			moving: true
		});
		expect(text(h)).toContain('Moving…');
		expect(text(h)).not.toContain('Not contacted yet');
	});
	test('sample and opted-out chips plus the due badge', () => {
		const h = html(ContactCard, {
			contact: contact({ sample: true, emailOptOutAt: '2026-10-01T00:00:00.000Z' }),
			nextTask: task({ dueDate: '2026-10-02' }),
			today: TODAY,
			variant: 'board'
		});
		expect(text(h)).toContain('Sample data');
		expect(text(h)).toContain('No emails');
		expect(text(h)).toContain('Overdue · Oct 2');
		expect(h).toMatch(/<span[^>]*data-no-emails[^>]*text-muted-foreground/);
	});
	test('renders the actions snippet', () => {
		const actions = createRawSnippet(() => ({
			render: () => '<button type="button">Move</button>'
		}));
		const h = html(ContactCard, {
			contact: contact(),
			nextTask: null,
			today: TODAY,
			variant: 'board',
			actions
		});
		expect(h).toContain('>Move</button>');
	});
});

describe('SmartListFilter', () => {
	const counts = { all: 12, 'due-today': 3, 'no-contact-7d': 0, 'new-this-week': 5 };

	test('group of four toggle buttons with counts, exactly one pressed', () => {
		const h = html(SmartListFilter, { value: 'due-today', counts });
		expect(h).toMatch(/<div[^>]*role="group"[^>]*aria-label="Show"/);
		const buttons = [...h.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
		expect(buttons).toHaveLength(4);
		expect(buttons.map((b) => text(b[2]))).toEqual([
			'All (12)',
			'Due today (3)',
			'No contact in 7 days (0)',
			'New this week (5)'
		]);
		expect(buttons.map((b) => /aria-pressed="(\w+)"/.exec(b[1])?.[1])).toEqual([
			'false',
			'true',
			'false',
			'false'
		]);
		expect(buttons.every((b) => b[1].includes('type="button"') && b[1].includes('min-h-11'))).toBe(
			true
		);
		expect(buttons[1][2]).toContain('<svg');
		expect(buttons[0][2]).not.toContain('<svg');
		expect(buttons[1][1]).toContain('bg-foreground');
		expect(h).not.toContain('bg-primary');
	});
	test('defaults to All', () => {
		const h = html(SmartListFilter, { counts });
		expect(h.match(/aria-pressed="true"/g)).toHaveLength(1);
		expect(h).toMatch(/<button[^>]*aria-pressed="true"[^>]*data-list="all"/);
	});
});
