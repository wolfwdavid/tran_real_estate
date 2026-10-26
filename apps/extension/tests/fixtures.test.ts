import { afterEach, describe, expect, test } from 'vitest';
import { CONFIG } from '../src/lib/config';
import { classify, findContainer, itemsIn } from '../src/lib/detect';
import { FIXTURES, mount } from './fixtures/cards';

afterEach(() => {
	document.body.innerHTML = '';
});

describe.each(FIXTURES.map((f) => [f.name, f] as const))('fixture %s', (_name, fixture) => {
	test('dims exactly the expected items', () => {
		mount(document, fixture.html);
		const container = findContainer(document, CONFIG);
		expect(container).not.toBeNull();
		const items = itemsIn(container as Element, CONFIG);
		const ids = [...fixture.dimmed, ...fixture.clean];
		expect(items.map((el) => el.id).sort()).toEqual([...ids].sort());
		const dimmed = items.filter((el) => classify(el, CONFIG) !== null).map((el) => el.id);
		expect(dimmed.sort()).toEqual([...fixture.dimmed].sort());
	});

	test('every clean item classifies null', () => {
		mount(document, fixture.html);
		for (const id of fixture.clean) {
			const el = document.getElementById(id);
			expect(el, id).not.toBeNull();
			expect(classify(el as Element, CONFIG), id).toBeNull();
		}
	});
});

test('the fixture set covers ad-slot, label, and attribute paths', () => {
	const via = new Set<string>();
	for (const fixture of FIXTURES) {
		mount(document, fixture.html);
		for (const id of fixture.dimmed) {
			const hit = classify(document.getElementById(id) as Element, CONFIG);
			if (hit) via.add(hit.via);
		}
	}
	expect([...via].sort()).toEqual(['ad-slot', 'attribute', 'label']);
});
