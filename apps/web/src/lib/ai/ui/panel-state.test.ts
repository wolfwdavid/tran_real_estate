// PanelState controller (05-13 Task 1): streaming, Stop, sample fallback, the Gemini gate, exit
// gating with postChecks, tokens, the three exits with onExit/emailFooter/exitDisabled, edit
// rechecks and Draft history open. All fakes are in-memory; nothing touches the network.
import { describe, expect, test, vi } from 'vitest';
import { LlmError, type AiProviderId, type LlmFinish, type LlmUsage } from '@tran/core/ai';
import type { Finding, FindingMember } from '@tran/core/fair-housing';
import { GEMINI_ACK_KEY } from '../gemini-gate';
import type { LlmEvent, LlmProvider, LlmRequest } from '../ports';
import { DEMO_INPUTS } from '../prompts/shared/demo.v1';
import { fixtureProvider } from '../providers/fixture';
import type { Selection } from '../setup';
import type { ArtifactInput, ArtifactRepo } from '../storage/artifacts';
import type { AiArtifact } from '../storage/tables';
import { PanelState, type PanelDeps } from './panel-state.svelte';
import { numbersCopy, numbersStub } from './post-check.fixtures';

const abortError = () => new DOMException('Aborted', 'AbortError');

type Script = {
	chunks: string[];
	finish?: LlmFinish;
	usage?: LlmUsage;
	/** Thrown after the chunks. */
	error?: unknown;
	/** Wait for abort after the chunks (a stream the user stops). */
	hold?: boolean;
	/** Real ms to wait before the first chunk. */
	delayFirst?: number;
};

function scripted(id: AiProviderId, script: Script) {
	const requests: LlmRequest[] = [];
	const provider: LlmProvider = {
		id,
		async *stream(req, signal): AsyncGenerator<LlmEvent> {
			requests.push(req);
			if (script.delayFirst) await new Promise((r) => setTimeout(r, script.delayFirst));
			for (const text of script.chunks) {
				if (signal.aborted) throw abortError();
				yield { type: 'text', text };
			}
			if (script.error) throw script.error;
			if (script.hold) {
				await new Promise((_, reject) => {
					if (signal.aborted) reject(abortError());
					signal.addEventListener('abort', () => reject(abortError()), { once: true });
				});
			}
			if (script.usage) yield { type: 'usage', usage: script.usage };
			yield { type: 'finish', reason: script.finish ?? 'stop' };
		}
	};
	return { provider, requests };
}

function memoryRepo() {
	const rows = new Map<string, AiArtifact>();
	let n = 0;
	const repo = {
		create: vi.fn(async (i: ArtifactInput) => {
			const a = {
				id: `a${++n}`,
				status: 'draft',
				sentAt: null,
				feature: i.feature,
				promptId: i.promptId,
				provider: i.provider,
				model: i.model,
				sample: i.sample,
				inputHash: i.inputHash,
				text: i.text,
				findings: []
			} as unknown as AiArtifact;
			rows.set(a.id, a);
			return a;
		}),
		updateText: vi.fn(async () => {}),
		setStatus: vi.fn(async () => {}),
		get: vi.fn(async (id: string) => rows.get(id)),
		listByFeature: vi.fn(async () => []),
		countByFeature: vi.fn(async () => 0),
		listBySubject: vi.fn(async () => []),
		countBySubject: vi.fn(async () => 0),
		deleteBySubjectId: vi.fn(async () => 0),
		softDelete: vi.fn(async () => {})
	};
	return repo satisfies ArtifactRepo;
}

function fakeSession() {
	const m = new Map<string, string>();
	return {
		map: m,
		getItem: vi.fn((k: string) => m.get(k) ?? null),
		setItem: vi.fn((k: string, v: string) => void m.set(k, v))
	};
}

const LIVE = (id: 'anthropic' | 'gemini' | 'openai' | 'openrouter'): Selection => ({
	kind: 'live',
	id
});

function setup(
	o: {
		selection?: Selection;
		script?: Script;
		provider?: LlmProvider;
		deps?: Partial<PanelDeps>;
	} = {}
) {
	const selection = o.selection ?? LIVE('anthropic');
	const s = scripted(
		selection.kind === 'live' ? selection.id : 'fixture',
		o.script ?? {
			chunks: ['Bright ', 'two-bedroom ', 'near transit.']
		}
	);
	const provider = o.provider ?? s.provider;
	const repo = memoryRepo();
	const announce = vi.fn<(m: string) => void>();
	const clipboard = { writeText: vi.fn(async (t: string) => void t) };
	const session = fakeSession();
	const onExit = vi.fn();
	const deps: PanelDeps = {
		promptId: 'shared/demo',
		inputs: DEMO_INPUTS,
		feature: 'demo',
		resolve: async () => ({ selection, provider, model: 'claude-sonnet-5' }),
		repo,
		announce,
		clipboard,
		session,
		onExit,
		now: () => new Date('2026-10-05T15:00:00Z'),
		waitMs: 10_000,
		...o.deps
	};
	const state = new PanelState(deps);
	return { state, repo, announce, clipboard, session, onExit, requests: s.requests };
}

const said = (announce: ReturnType<typeof vi.fn>) => announce.mock.calls.map((c) => c[0]);

function claimsCheck(text: string): Finding[] {
	const m: FindingMember = {
		entryId: 'claims.best',
		checker: 'claims',
		category: 'claims',
		categoryLabel: 'Unverified claim',
		scope: 'other',
		severity: 'block',
		explanation: 'Superlatives need support.',
		alternative: 'A good',
		source: 'Phase 7 claims check',
		phrase: text.slice(0, 4),
		start: 0,
		end: 4
	};
	return [{ id: '0-4', start: 0, end: 4, severity: 'block', phrase: m.phrase, members: [m] }];
}

describe('streaming, Stop and sample output', () => {
	test('live run: connecting, streaming, ready, usage and one stored artifact', async () => {
		const { state, repo, announce } = setup({
			script: {
				chunks: ['Bright ', 'two-bedroom ', 'near transit.'],
				usage: { inputTokens: 1200, outputTokens: 300 }
			}
		});
		const run = state.generate();
		// Before the first token is observable the connecting copy is already set.
		await vi.waitFor(() => expect(said(announce)).toContain('Drafting with Anthropic.'));
		await run;
		expect(said(announce)[0]).toBe('Drafting with Anthropic.');
		expect(state.phase).toBe('ready');
		expect(state.text).toBe('Bright two-bedroom near transit.');
		expect(state.statusLine).toBe('Draft ready.');
		expect(said(announce)).toContain('Draft ready. No Fair Housing problem phrases found.');
		expect(state.usageText).toMatch(/^1,200 tokens in · 300 tokens out/);
		expect(repo.create).toHaveBeenCalledTimes(1);
		const input = repo.create.mock.calls[0]![0];
		expect(input.promptId).toBe('shared/demo@1');
		expect(input.inputHash).toBe(state.built?.inputHash);
		expect(input.inputHash).toMatch(/^[0-9a-f]{64}$/);
		expect(input.sample).toBe(false);
		expect(state.artifactId).toBe('a1');
		expect(state.gate.canExit).toBe(true);
	});

	test('subjectId is stored with the artifact when given, and absent otherwise', async () => {
		const tagged = setup({ deps: { subjectId: 'L1' } });
		await tagged.state.generate();
		expect(tagged.repo.create.mock.calls[0]![0].subjectId).toBe('L1');

		const plain = setup();
		await plain.state.generate();
		expect(plain.repo.create.mock.calls[0]![0]).not.toHaveProperty('subjectId');
	});

	test('connecting status line before the first token, then Writing…', async () => {
		let release!: () => void;
		let finish!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const end = new Promise<void>((r) => (finish = r));
		const provider: LlmProvider = {
			id: 'anthropic',
			async *stream() {
				await gate;
				yield { type: 'text', text: 'Hi' };
				await end;
				yield { type: 'finish', reason: 'stop' };
			}
		};
		const { state } = setup({ provider });
		const run = state.generate();
		await vi.waitFor(() => expect(state.phase).toBe('connecting'));
		expect(state.statusLine).toBe('Connecting to Anthropic…');
		release();
		await vi.waitFor(() => expect(state.phase).toBe('streaming'));
		expect(state.statusLine).toBe('Writing…');
		finish();
		await run;
	});

	test('Stop keeps the partial draft, checks it and stores it', async () => {
		const { state, repo, announce } = setup({
			script: { chunks: ['Perfect for young professionals. '], hold: true }
		});
		const run = state.generate();
		await vi.waitFor(() => expect(state.text).toBe('Perfect for young professionals. '));
		expect(state.running).toBe(true);
		state.stop();
		await run;
		expect(state.phase).toBe('ready');
		expect(state.text).toBe('Perfect for young professionals. ');
		expect(state.statusLine).toBe(
			'Stopped. The partial draft is kept, so you can edit it, use it, or generate again.'
		);
		expect(state.findings.some((f) => f.severity === 'block')).toBe(true);
		expect(said(announce)).toContain('Stopped. Partial draft kept. 1 Fair Housing phrase to fix.');
		expect(state.usageText).toBe("Anthropic didn't report usage for this stopped draft.");
		expect(repo.create).toHaveBeenCalledTimes(1);
		expect(repo.create.mock.calls[0]![0].text).toBe('Perfect for young professionals. ');
	});

	test('Stop before any text arrives says nothing was kept and stores nothing', async () => {
		const { state, repo, announce } = setup({ script: { chunks: [], hold: true } });
		const run = state.generate();
		await vi.waitFor(() => expect(state.running).toBe(true));
		state.stop();
		await run;
		expect(state.text).toBe('');
		expect(state.hasDraft).toBe(false);
		expect(state.statusLine).toBe(
			'Stopped before any text arrived. Nothing was saved, so you can generate again.'
		);
		expect(said(announce)).toContain(
			'Stopped before any text arrived. Nothing was saved, so you can generate again.'
		);
		expect(said(announce).join(' ')).not.toContain('Partial draft kept');
		expect(repo.create).not.toHaveBeenCalled();
	});

	test('length finish uses the length-limit status', async () => {
		const { state } = setup({ script: { chunks: ['Short and'], finish: 'length' } });
		await state.generate();
		expect(state.statusLine).toBe(
			'Draft ready, but it reached the length limit and may end mid-sentence. Edit the ending, or generate again.'
		);
	});

	test('sample selection streams the fixture with the sample copy and no cost', async () => {
		const lines = new Set<string>();
		const box: { state?: PanelState } = {};
		const provider = fixtureProvider({
			sleep: async () => {
				lines.add(box.state!.statusLine);
			}
		});
		const t = setup({
			selection: { kind: 'sample', reason: 'no-key', id: null },
			provider
		});
		box.state = t.state;
		const { state, announce, repo } = t;
		await state.generate();
		expect([...lines]).toEqual(['Writing sample output…']);
		expect(said(announce)).toContain('Showing sample output.');
		expect(state.usageText).toBe('Sample output: no tokens used, no cost.');
		expect(state.text.length).toBeGreaterThan(20);
		expect(state.sample).toBe(true);
		expect(repo.create.mock.calls[0]![0].sample).toBe(true);
		expect(repo.create.mock.calls[0]![0].provider).toBe('fixture');
	});

	test('locked selection: no provider call, the locked error', async () => {
		const { state, requests, announce } = setup({
			selection: { kind: 'locked', id: 'anthropic' }
		});
		await state.generate();
		expect(requests).toHaveLength(0);
		expect(state.error?.title).toBe('Your keys are locked');
		expect(state.error?.action?.hash).toBe('key-security');
		expect(said(announce)[0]).toMatch(/^Your keys are locked\. /);
	});

	test('auth error keeps partial text and announces title and body', async () => {
		const { state, announce } = setup({
			script: { chunks: ['Partial '], error: new LlmError('auth') }
		});
		await state.generate();
		expect(state.text).toBe('Partial ');
		expect(state.error?.title).toBe("Anthropic didn't accept your key");
		const e = state.error!;
		expect(said(announce)).toContain(`${e.title}. ${e.body}`);
	});

	test('waiting line after waitMs without a first token, announced once', async () => {
		const { state, announce } = setup({
			script: { chunks: ['Late.'], delayFirst: 40 },
			deps: { waitMs: 5 }
		});
		await state.generate();
		const waiting = 'Still waiting for Anthropic. You can keep waiting or stop.';
		expect(said(announce).filter((m) => m === waiting)).toHaveLength(1);
		expect(state.statusLine).toBe('Draft ready.');
	});
});

describe('Gemini client-data gate (AI-03)', () => {
	test('live Gemini + client data opens the dialog with zero requests', async () => {
		const { state, requests } = setup({ selection: LIVE('gemini') });
		await state.generate();
		expect(state.geminiDialogOpen).toBe(true);
		expect(requests).toHaveLength(0);
	});

	test('cancel: dialog closed, canceled copy, nothing sent, session untouched', async () => {
		const { state, requests, session, announce } = setup({ selection: LIVE('gemini') });
		await state.generate();
		state.cancelGemini();
		expect(state.geminiDialogOpen).toBe(false);
		expect(state.statusLine).toBe('Canceled. Nothing was sent to Google.');
		expect(said(announce)).toContain('Canceled. Nothing was sent to Google.');
		expect(requests).toHaveLength(0);
		expect(session.setItem).not.toHaveBeenCalled();
	});

	test('confirm without "don\'t ask again": runs with clientDataAck, session not written', async () => {
		const { state, requests, session } = setup({ selection: LIVE('gemini') });
		await state.generate();
		await state.confirmGemini(false);
		expect(requests).toHaveLength(1);
		expect(requests[0]!.clientDataAck).toBe(true);
		expect(session.setItem).not.toHaveBeenCalled();
		expect(state.text).toBe('Bright two-bedroom near transit.');
	});

	test('confirm with "don\'t ask again": session written once, next generate skips the dialog', async () => {
		const { state, requests, session } = setup({ selection: LIVE('gemini') });
		await state.generate();
		await state.confirmGemini(true);
		expect(session.setItem).toHaveBeenCalledTimes(1);
		expect(session.setItem).toHaveBeenCalledWith(GEMINI_ACK_KEY, '1');
		expect(GEMINI_ACK_KEY).toBe('tran.ai.gemini-client-data-ack');
		await state.generate();
		expect(state.geminiDialogOpen).toBe(false);
		expect(requests).toHaveLength(2);
		expect(requests[1]!.clientDataAck).toBe(true);
	});

	test('sample selection with Gemini chosen never opens the dialog', async () => {
		const { state } = setup({
			selection: { kind: 'sample', reason: 'toggle', id: 'gemini' },
			provider: fixtureProvider({ sleep: async () => {} })
		});
		await state.generate();
		expect(state.geminiDialogOpen).toBe(false);
		expect(state.text).not.toBe('');
	});
});

describe('exit gating with Fair Housing findings and postChecks', () => {
	test('a block finding gates all three exits', async () => {
		const { state } = setup({ script: { chunks: ['Perfect for young professionals.'] } });
		await state.generate();
		const reason = 'Fix the 1 phrase marked Must fix to copy or email this draft.';
		for (const k of ['copy', 'email', 'marked-sent'] as const) {
			expect(state.gate.exits[k]).toEqual({ gated: true, reason });
		}
		expect(state.gate.canExit).toBe(false);
		expect(state.gate.blocked).toBe(true);
	});

	test('postChecks block finding disables all three exits on clean text', async () => {
		const { state } = setup({
			script: { chunks: ['Best deal around.'] },
			deps: { postChecks: [claimsCheck] }
		});
		await state.generate();
		const claim = state.findings.find((f) => f.members[0]?.checker === 'claims');
		expect(claim).toBeDefined();
		expect(claimsCheck('Best deal around.')[0]!.members[0]).toMatchObject({ checker: 'claims' });
		for (const k of ['copy', 'email', 'marked-sent'] as const) {
			expect(state.gate.exits[k].gated).toBe(true);
		}
		expect(state.gate.blocked).toBe(true);
	});

	test('apply replaces, rechecks, announces and ungates', async () => {
		const { state, announce } = setup({ script: { chunks: ['Perfect for young professionals.'] } });
		await state.generate();
		const block = state.findings.find((f) => f.severity === 'block')!;
		const r = state.apply(block.id);
		expect(state.text).toBe('Close to transit and downtown.');
		expect(state.findings).toEqual([]);
		expect(r.nextFindingId).toBeNull();
		expect(said(announce)).toContain(
			'Replaced with "close to transit and downtown". No Fair Housing flags left.'
		);
		expect(state.gate.canExit).toBe(true);
	});

	test('warn-only: gated until acknowledged; the ack follows the warn phrase set', async () => {
		const { state } = setup({ script: { chunks: ['Walking distance to church.'] } });
		await state.generate();
		expect(state.gate.exits.copy).toEqual({
			gated: true,
			reason: 'Review the flagged phrases and check the box above to continue.'
		});
		state.warnAck = true;
		expect(state.gate.canExit).toBe(true);

		state.setText('Walking distance to church. Great light.');
		state.recheckNow();
		expect(state.warnAck).toBe(true);

		state.setText('Near the synagogue. Great light.');
		state.recheckNow();
		expect(state.warnAck).toBe(false);
		expect(state.gate.canExit).toBe(false);
	});

	test('setText rechecks after the debounce', async () => {
		vi.useFakeTimers();
		try {
			const { state } = setup({ deps: { recheckMs: 300 } });
			// Seed a ready draft without streaming (fake timers).
			state.setText('Perfect for young professionals.');
			expect(state.findings).toEqual([]);
			vi.advanceTimersByTime(299);
			expect(state.findings).toEqual([]);
			vi.advanceTimersByTime(1);
			expect(state.findings).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('tokens (restored locally, never sent)', () => {
	test('display, copy and mailto use the restored value; requests never contain it', async () => {
		const { state, requests, clipboard } = setup({
			script: { chunks: ['Hi {client_first_name}', ', thanks.'] },
			deps: { tokens: { client_first_name: 'Dana' } }
		});
		await state.generate();
		expect(state.text).toBe('Hi Dana, thanks.');
		expect(requests).toHaveLength(1);
		for (const r of requests) {
			expect(r.user).not.toContain('Dana');
			expect(r.system).not.toContain('Dana');
		}
		await state.copy();
		expect(clipboard.writeText).toHaveBeenCalledWith('Hi Dana, thanks.');
		expect(state.mailto.href).toContain('Hi%20Dana%2C%20thanks.');
	});
});

describe('exits (AI-04) and onExit', () => {
	test('copy success: clipboard, status, reviewed, onExit once', async () => {
		const { state, clipboard, repo, onExit } = setup();
		await state.generate();
		expect(await state.copy()).toBe(true);
		expect(clipboard.writeText).toHaveBeenCalledWith('Bright two-bedroom near transit.');
		expect(state.statusLine).toBe('Copied to your clipboard.');
		expect(repo.setStatus).toHaveBeenCalledWith('a1', 'acknowledged', expect.any(Date));
		expect(state.artifactStatus).toBe('acknowledged');
		expect(onExit).toHaveBeenCalledTimes(1);
		expect(onExit).toHaveBeenCalledWith('copy', {
			text: 'Bright two-bedroom near transit.',
			artifactId: 'a1'
		});
	});

	test('copy failure: failure copy, no onExit', async () => {
		const { state, onExit, clipboard } = setup();
		clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
		await state.generate();
		expect(await state.copy()).toBe(false);
		expect(state.statusLine).toBe(
			"Your browser didn't allow copying. The draft is selected, so press Ctrl+C or ⌘C to copy it."
		);
		expect(onExit).not.toHaveBeenCalled();
	});

	test('emailClicked: status, reviewed, onExit with the href', async () => {
		const { state, onExit, repo } = setup({ deps: { mailto: { to: 'agent@example.com' } } });
		await state.generate();
		expect(state.emailClicked()).toBe(true);
		expect(state.statusLine).toBe(
			"Opened in your email app. Tran doesn't send it. Review it there and press send yourself."
		);
		await vi.waitFor(() =>
			expect(repo.setStatus).toHaveBeenCalledWith('a1', 'acknowledged', expect.any(Date))
		);
		expect(onExit).toHaveBeenCalledTimes(1);
		expect(onExit.mock.calls[0]![0]).toBe('email');
		expect(onExit.mock.calls[0]![1]).toMatchObject({ artifactId: 'a1', href: state.mailto.href });
		expect(state.mailto.href.startsWith('mailto:agent@example.com?body=')).toBe(true);
	});

	test('markSent: repo, dated status, announcement, onExit once; second press does nothing', async () => {
		const { state, repo, onExit, announce } = setup();
		await state.generate();
		await state.markSent();
		const at = new Date('2026-10-05T15:00:00Z');
		expect(repo.setStatus).toHaveBeenCalledWith('a1', 'sent', at);
		const date = new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(at);
		expect(state.statusLine).toBe(
			`Marked as sent on ${date}. This is a note in Draft history on this device, not a delivery receipt.`
		);
		expect(said(announce)).toContain('Marked as sent in Draft history.');
		expect(state.artifactStatus).toBe('sent');
		expect(onExit).toHaveBeenCalledTimes(1);
		expect(onExit.mock.calls[0]![0]).toBe('marked-sent');
		await state.markSent();
		expect(onExit).toHaveBeenCalledTimes(1);
		expect(repo.setStatus).toHaveBeenCalledTimes(1);
	});

	test('gated exits do nothing but announce the reason', async () => {
		const { state, clipboard, repo, onExit, announce } = setup({
			script: { chunks: ['Perfect for young professionals.'] }
		});
		await state.generate();
		announce.mockClear();
		expect(await state.copy()).toBe(false);
		expect(state.emailClicked()).toBe(false);
		await state.markSent();
		expect(clipboard.writeText).not.toHaveBeenCalled();
		expect(repo.setStatus).not.toHaveBeenCalled();
		expect(onExit).not.toHaveBeenCalled();
		const reason = 'Fix the 1 phrase marked Must fix to copy or email this draft.';
		expect(said(announce)).toEqual([reason, reason, reason]);
	});

	test('emailFooter is appended to copy and mailto; the check runs on the draft only', async () => {
		const footer = { text: 'Reply STOP to opt out.', label: 'Added to emails' };
		const { state, clipboard } = setup({
			script: { chunks: ['Hello there.'] },
			deps: {
				emailFooter: footer,
				postChecks: [(t) => (t.includes('STOP') ? claimsCheck(t) : [])]
			}
		});
		await state.generate();
		expect(state.findings).toEqual([]);
		await state.copy();
		expect(clipboard.writeText.mock.calls[0]![0].endsWith('\n\nReply STOP to opt out.')).toBe(true);
		expect(state.mailto.href.endsWith('%0D%0A%0D%0AReply%20STOP%20to%20opt%20out.')).toBe(true);
	});

	test('exitDisabled gates only the named exit with its reason', async () => {
		const { state, onExit } = setup({
			deps: { exitDisabled: { email: 'This contact has no email address.' } }
		});
		await state.generate();
		expect(state.gate.exits.email).toEqual({
			gated: true,
			reason: 'This contact has no email address.'
		});
		expect(state.gate.exits.copy.gated).toBe(false);
		expect(state.gate.exits['marked-sent'].gated).toBe(false);
		expect(state.emailClicked()).toBe(false);
		expect(onExit).not.toHaveBeenCalled();
	});

	test('mailto.long once the encoded href exceeds 1,800 characters', async () => {
		const { state } = setup({ script: { chunks: ['word '.repeat(400)] } });
		await state.generate();
		expect(state.mailto.href.length).toBeGreaterThan(1800);
		expect(state.mailto.long).toBe(true);
	});
});

describe('Draft history open', () => {
	test('re-runs the current checker and keeps the stored status', () => {
		const { state, announce } = setup();
		const artifact = {
			id: 'old',
			text: 'No kids.',
			status: 'sent',
			sentAt: '2026-10-01T12:00:00.000Z',
			model: 'claude-sonnet-5',
			findings: []
		} as unknown as AiArtifact;
		state.open(artifact);
		expect(state.findings.length).toBe(1);
		expect(state.artifactStatus).toBe('sent');
		expect(state.artifactId).toBe('old');
		expect(said(announce)).toContain('Draft opened. 1 Fair Housing phrase to fix.');
	});
});

describe('Phase 7 additive deps: checkGroups, artifactMeta', () => {
	test('a post-check group adds its done sentence after the Fair Housing sentence', async () => {
		const { state, announce } = setup({
			script: { chunks: ['Cash flow ', 'is 20%.'] },
			deps: { postChecks: [numbersStub], checkGroups: [numbersCopy] }
		});
		await state.generate();
		expect(said(announce)).toContain(
			'Draft ready. No Fair Housing problem phrases found. 1 number to fix.'
		);
		expect(state.gate.blocked).toBe(true);
		for (const k of ['copy', 'email', 'marked-sent'] as const) {
			expect(state.gate.exits[k].gated).toBe(true);
		}
	});

	test('without checkGroups the post-check finding counts in the Phase 5 sentence', async () => {
		const { state, announce } = setup({
			script: { chunks: ['Cash flow is 20%.'] },
			deps: { postChecks: [numbersStub] }
		});
		await state.generate();
		expect(said(announce)).toContain('Draft ready. 1 Fair Housing phrase to fix.');
	});

	test('a passing group says so', async () => {
		const { state, announce } = setup({
			script: { chunks: ['Cash flow is fine.'] },
			deps: { postChecks: [numbersStub], checkGroups: [numbersCopy] }
		});
		await state.generate();
		expect(said(announce)).toContain(
			'Draft ready. No Fair Housing problem phrases found. Every number matches your analysis.'
		);
	});

	test('subjectId and artifactMeta reach repo.create; absent means no keys', async () => {
		const tagged = setup({
			deps: { subjectId: 'deal-1', artifactMeta: { analysisHash: 'abc12345' } }
		});
		await tagged.state.generate();
		const input = tagged.repo.create.mock.calls[0]![0];
		expect(input.subjectId).toBe('deal-1');
		expect(input.meta).toEqual({ analysisHash: 'abc12345' });

		const plain = setup();
		await plain.state.generate();
		const bare = plain.repo.create.mock.calls[0]![0];
		expect(bare).not.toHaveProperty('subjectId');
		expect(bare).not.toHaveProperty('meta');
	});
});
