// SSR structural tests for the Fair Housing flag UI (05-12). Components render to a string with
// `svelte/server`; assertions read the markup and the tag-stripped text. onMount never runs here.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { checkFairHousing, type Finding, type FindingMember } from '@tran/core/fair-housing';
import FairHousingText from './FairHousingText.svelte';
import FindingDetails from './FindingDetails.svelte';
import FindingsSummary from './FindingsSummary.svelte';

const TEXT = 'Perfect for young professionals. It is walking distance to church.';
const BLOCK_PREFIX = 'Fair Housing problem, must fix: ';
const WARN_PREFIX = 'Fair Housing caution, review: ';
const STATE_LINE = 'Protected under many state and local laws.';
const ACK =
	"I've reviewed the flagged phrases. They describe the property, not who should live there.";

const decode = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
const strip = (h: string) => decode(h.replace(/<[^>]+>/g, ''));
const count = (h: string, re: RegExp) => (h.match(re) ?? []).length;

function fixture() {
	const findings = checkFairHousing(TEXT);
	const block = findings.find((f) => f.severity === 'block');
	const warn = findings.find((f) => f.severity === 'warn');
	if (!block || !warn) throw new Error('fixture must produce one block and one warn finding');
	return { findings, block, warn };
}

// Loose props on purpose: the tests also pass hand-built findings and partial prop sets.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function html(component: Component<any>, props: Record<string, unknown>): string {
	return render(component, { props }).body;
}

describe('fixture', () => {
	test('the lexicon yields exactly one block and one warn finding', () => {
		const { findings } = fixture();
		expect(findings.map((f) => f.severity)).toEqual(['block', 'warn']);
	});
});

describe('FairHousingText', () => {
	test('renders one mark per finding, block then warn in reading order', () => {
		const { findings } = fixture();
		const body = html(FairHousingText, { text: TEXT, findings, idPrefix: 'demo' });
		expect(count(body, /<mark\b/g)).toBe(2);
		const classes = [...body.matchAll(/<mark\b[^>]*class="([^"]*)"/g)].map((m) => m[1]);
		expect(classes[0]).toContain('finding--block');
		expect(classes[1]).toContain('finding--warn');
	});

	test('each mark wraps a dialog trigger button', () => {
		const { findings } = fixture();
		const body = html(FairHousingText, { text: TEXT, findings, idPrefix: 'demo' });
		const marks = [...body.matchAll(/<mark\b[\s\S]*?<\/mark>/g)].map((m) => m[0]);
		expect(marks).toHaveLength(2);
		for (const mark of marks) {
			const button = mark.match(/<button\b[^>]*>/)?.[0] ?? '';
			expect(button).toContain('type="button"');
			expect(button).toContain('aria-haspopup="dialog"');
			expect(button).toContain('aria-expanded="false"');
			expect(button).toMatch(/aria-controls="[^"]+"/);
		}
	});

	test('hidden prefixes live in sr-only spans', () => {
		const { findings } = fixture();
		const body = html(FairHousingText, { text: TEXT, findings, idPrefix: 'demo' });
		expect(body).toMatch(
			new RegExp(`<span[^>]*class="[^"]*sr-only[^"]*"[^>]*>${BLOCK_PREFIX}</span>`)
		);
		expect(body).toMatch(
			new RegExp(`<span[^>]*class="[^"]*sr-only[^"]*"[^>]*>${WARN_PREFIX}</span>`)
		);
	});

	test('stripping tags and hidden prefixes reproduces the draft exactly', () => {
		const { findings } = fixture();
		const body = html(FairHousingText, { text: TEXT, findings, idPrefix: 'demo' });
		expect(strip(body).replace(BLOCK_PREFIX, '').replace(WARN_PREFIX, '')).toBe(TEXT);
	});

	test('text without findings renders verbatim with no mark', () => {
		const text = 'Sunny two-bedroom with a wheelchair accessible entrance.';
		const body = html(FairHousingText, {
			text,
			findings: checkFairHousing(text),
			idPrefix: 'x'
		});
		expect(body).not.toMatch(/<mark\b/);
		expect(strip(body)).toBe(text);
	});

	test('HTML-like model text is escaped, never parsed', () => {
		const body = html(FairHousingText, { text: '<b>x</b>', findings: [], idPrefix: 'x' });
		expect(body).toContain('&lt;b>');
		expect(body).not.toContain('<b>');
		expect(strip(body)).toBe('<b>x</b>');
	});
});

describe('FindingDetails', () => {
	test('block finding: severity, category, explanation, wording, basis and actions', () => {
		const { block } = fixture();
		const body = html(FindingDetails, { finding: block, headingId: 'h1' });
		const text = strip(body);
		const m = block.members[0];
		expect(text).toContain('Must fix');
		expect(text).toContain('Category: Familial status');
		expect(text).toContain(m.explanation);
		expect(text).toContain('Suggested wording:');
		expect(text).toContain('“close to transit and downtown”');
		expect(text).toContain('Based on: HUD Achtenberg memo (1995), familial status');
		expect(body).toMatch(/<button\b[^>]*>[\s\S]*?Use alternative[\s\S]*?<\/button>/);
		expect(body).toMatch(/<button\b[^>]*>[\s\S]*?Edit it myself[\s\S]*?<\/button>/);
		expect(text).not.toContain(STATE_LINE);
		expect(body).toContain('id="h1"');
	});

	test('empty alternative: remove-phrase copy and the state line', () => {
		const text = 'Quiet unit, no Section 8.';
		const finding = checkFairHousing(text).find((f) =>
			f.members.some((x) => x.category === 'source-of-income')
		);
		expect(finding).toBeDefined();
		const body = html(FindingDetails, { finding, headingId: 'h2' });
		const out = strip(body);
		expect(out).toContain('Suggested fix: remove this phrase.');
		expect(out).toContain('Remove phrase');
		expect(out).not.toContain('Use alternative');
		expect(out).toContain(STATE_LINE);
	});

	test('a merged finding lists every member category in order', () => {
		const { block } = fixture();
		const first = block.members[0];
		const second: FindingMember = {
			...first,
			entryId: 'age.test',
			category: 'age',
			categoryLabel: 'Age',
			scope: 'state'
		};
		const merged: Finding = { ...block, members: [first, second] };
		const out = strip(html(FindingDetails, { finding: merged, headingId: 'h3' }));
		const a = out.indexOf('Category: Familial status');
		const b = out.indexOf('Category: Age');
		expect(a).toBeGreaterThanOrEqual(0);
		expect(b).toBeGreaterThan(a);
		expect(out).toContain(STATE_LINE);
	});

	test('a postCheck member shows its own label and no state line', () => {
		const member: FindingMember = {
			entryId: 'claims.guaranteed',
			checker: 'claims',
			category: 'unsupported-claim',
			categoryLabel: 'Unsupported claim',
			scope: 'other',
			severity: 'warn',
			explanation: 'This promises a result the listing data does not show.',
			alternative: 'well kept',
			source: 'Tran listing copy rules',
			phrase: 'guaranteed',
			start: 0,
			end: 10
		};
		const finding: Finding = {
			id: '0-10',
			start: 0,
			end: 10,
			severity: 'warn',
			phrase: 'guaranteed',
			members: [member]
		};
		const out = strip(html(FindingDetails, { finding, headingId: 'h4' }));
		expect(out).toContain('Review');
		expect(out).toContain('Category: Unsupported claim');
		expect(out).not.toContain(STATE_LINE);
	});
});

describe('FindingsSummary', () => {
	test('no findings: title and limits note, no checkbox', () => {
		const body = html(FindingsSummary, { findings: [], idPrefix: 'p', headingLevel: 3 });
		const out = strip(body);
		expect(out).toContain('No Fair Housing problem phrases found');
		expect(out).toContain(
			"This check looks for known problem phrases. It can't catch everything, so read the draft before you use it."
		);
		expect(body).not.toContain('role="checkbox"');
		expect(out).not.toContain(ACK);
	});

	test('block + warn: counts, note, Must fix row first, actions, no acknowledgement', () => {
		const { findings } = fixture();
		const body = html(FindingsSummary, { findings, idPrefix: 'p', headingLevel: 3 });
		const out = strip(body);
		expect(out).toContain('Fair Housing check: 1 to fix, 1 to review');
		expect(out).toContain(
			"These flags are a plain-language check based on published Fair Housing advertising guidance. They're not legal advice."
		);
		const ol = body.match(/<ol\b[\s\S]*<\/ol>/)?.[0] ?? '';
		const rows = [...ol.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => strip(m[0]));
		expect(rows).toHaveLength(2);
		expect(rows[0]).toContain('Must fix');
		expect(rows[1]).toContain('Review');
		for (const row of rows) {
			expect(row).toContain('Use alternative');
			expect(row).toContain('Show in draft');
		}
		expect(body).not.toContain('role="checkbox"');
		expect(out).not.toContain(ACK);
	});

	test('Must fix rows come first even when a warn appears earlier in the text', () => {
		const text = 'It is walking distance to church. Perfect for young professionals.';
		const body = html(FindingsSummary, {
			findings: checkFairHousing(text),
			idPrefix: 'p',
			headingLevel: 3
		});
		const ol = body.match(/<ol\b[\s\S]*<\/ol>/)?.[0] ?? '';
		const rows = [...ol.matchAll(/<li\b[\s\S]*?<\/li>/g)].map((m) => strip(m[0]));
		expect(rows[0]).toContain('Must fix');
		expect(rows[1]).toContain('Review');
	});

	test('only warn findings: unchecked acknowledgement checkbox with its label', () => {
		const { warn } = fixture();
		const body = html(FindingsSummary, { findings: [warn], idPrefix: 'p', headingLevel: 3 });
		expect(body).toContain('role="checkbox"');
		expect(body).toMatch(
			/role="checkbox"[^>]*aria-checked="false"|aria-checked="false"[^>]*role="checkbox"/
		);
		expect(strip(body)).toContain(ACK);
	});

	test('checking state', () => {
		const out = strip(
			html(FindingsSummary, { findings: [], idPrefix: 'p', headingLevel: 3, checking: true })
		);
		expect(out).toContain('Checking for Fair Housing problem phrases…');
		expect(out).not.toContain('No Fair Housing problem phrases found');
	});

	test('title id, tabindex and heading level', () => {
		const { findings } = fixture();
		const h3 = html(FindingsSummary, { findings, idPrefix: 'p', headingLevel: 3 });
		expect(h3).toMatch(/<h3\b[^>]*id="p-findings-title"/);
		expect(h3).toMatch(/<h3\b[^>]*tabindex="-1"/);
		expect(h3).toContain('aria-labelledby="p-findings-title"');
		const h4 = html(FindingsSummary, { findings: [], idPrefix: 'q', headingLevel: 4 });
		expect(h4).toMatch(/<h4\b[^>]*id="q-findings-title"/);
		expect(h4).toMatch(/<h4\b[^>]*tabindex="-1"/);
	});
});

describe('source rules', () => {
	test('no component renders {@html}', () => {
		const dir = fileURLToPath(new URL('.', import.meta.url));
		const files = readdirSync(dir).filter((f) => f.endsWith('.svelte'));
		expect(files.length).toBeGreaterThanOrEqual(4);
		for (const f of files) {
			expect(readFileSync(`${dir}/${f}`, 'utf8'), f).not.toContain('{@html');
		}
	});
});
