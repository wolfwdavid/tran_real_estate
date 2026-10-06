// SSR structural tests for the shared agent primitives (08-10). svelte/server renders each component
// to a string in the node project; keyboard behaviour of the Move menu is covered by its owner plan.
import { render } from 'svelte/server';
import { createRawSnippet } from 'svelte';
import { describe, expect, test } from 'vitest';
import Inbox from '@lucide/svelte/icons/inbox';
import SampleChip from '$lib/components/sample/SampleChip.svelte';
import StageBadge from './StageBadge.svelte';
import NativeSelect from './NativeSelect.svelte';
import DateField from './DateField.svelte';
import UndoStatus from './UndoStatus.svelte';
import EmptyState from './EmptyState.svelte';

const clean = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const html = (C: any, props: Record<string, unknown> = {}) => clean(render(C, { props }).body);
const tag = (h: string, name: string) => new RegExp(`<${name}\\b[^>]*>`).exec(h)?.[0] ?? '';

describe('StageBadge', () => {
	test('shows the stage name as text only', () => {
		const h = html(StageBadge, { stage: 'touring' });
		expect(h).toContain('Touring');
		expect(h).not.toContain('<svg');
		expect(tag(h, 'span')).toContain('bg-surface');
	});
});

describe('SampleChip', () => {
	test('says Sample data with a decorative flask icon', () => {
		const h = html(SampleChip);
		expect(h).toContain('Sample data');
		expect(tag(h, 'svg')).toContain('aria-hidden="true"');
		expect(tag(h, 'span')).toContain('bg-accent-surface');
	});
});

describe('NativeSelect', () => {
	const props = {
		id: 'x',
		label: 'Stage',
		value: 'new',
		options: [
			{ value: 'new', label: 'New' },
			{ value: 'contacted', label: 'Contacted' }
		]
	};

	test('visible label tied to the select, icon chevron, no data: image', () => {
		const h = html(NativeSelect, props);
		expect(tag(h, 'label')).toMatch(/for="x"/);
		expect(h).toMatch(/<select[^>]*id="x"/);
		expect(tag(h, 'select')).toContain('h-12');
		expect(tag(h, 'select')).toContain('appearance-none');
		expect(h).toContain('>Contacted</option>');
		expect(h).not.toContain('data:');
		expect(tag(h, 'svg')).toContain('aria-hidden="true"');
		expect(tag(h, 'select')).not.toContain('aria-invalid="');
	});

	test('invalid state and description', () => {
		const h = html(NativeSelect, { ...props, invalid: true, describedby: 'x-err' });
		expect(tag(h, 'select')).toContain('aria-invalid="true"');
		expect(tag(h, 'select')).toContain('aria-describedby="x-err"');
	});
});

describe('DateField', () => {
	test('labelled 48px date input that keeps the calendar date as given', () => {
		const h = html(DateField, { id: 'due', label: 'Due', value: '2026-10-04' });
		expect(tag(h, 'label')).toMatch(/for="due"/);
		const input = tag(h, 'input');
		expect(input).toContain('type="date"');
		expect(input).toContain('value="2026-10-04"');
		expect(input).toContain('h-12');
	});
});

describe('UndoStatus', () => {
	test('renders nothing for a null message', () => {
		expect(html(UndoStatus, { message: null }).trim()).toBe('');
	});

	test('message without an undo handler has no button', () => {
		const h = html(UndoStatus, { message: 'Task deleted.', id: 'undo' });
		expect(h).toContain('Task deleted.');
		expect(tag(h, 'p')).toContain('tabindex="-1"');
		expect(tag(h, 'p')).toContain('id="undo"');
		expect(h).not.toContain('<button');
	});

	test('undo handler adds a 44px Undo button', () => {
		const h = html(UndoStatus, { message: 'Moved Ana to Touring.', onundo: () => {} });
		expect(h).toMatch(/<button[^>]*type="button"[^>]*>Undo<\/button>/);
		expect(tag(h, 'button')).toContain('min-h-11');
	});
});

describe('EmptyState', () => {
	const base = { icon: Inbox, title: 'No contacts yet', body: 'Add your first lead.' };

	test('h2 title, body and decorative icon', () => {
		const h = html(EmptyState, base);
		expect(h).toMatch(/<h2[^>]*>No contacts yet<\/h2>/);
		expect(h).toContain('Add your first lead.');
		expect(tag(h, 'svg')).toContain('aria-hidden="true"');
	});

	test('h3 when asked, and renders actions', () => {
		const children = createRawSnippet(() => ({ render: () => '<a href="/x">Add a lead</a>' }));
		const h = html(EmptyState, { ...base, headingLevel: 3, children });
		expect(h).toMatch(/<h3[^>]*>No contacts yet<\/h3>/);
		expect(h).not.toContain('<h2');
		expect(h).toContain('Add a lead');
	});
});
