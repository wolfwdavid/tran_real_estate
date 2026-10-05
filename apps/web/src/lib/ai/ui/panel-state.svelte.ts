// PanelState: the testable controller behind GenerationPanel. The Svelte view only renders these
// fields and calls these methods; every rule (streaming, Stop, sample fallback, the Gemini gate,
// exit gating, the three exits, edit rechecks, Draft history open) lives here and is unit-tested.
//
// Rules this file keeps:
// - The provider only ever receives the BuiltPrompt (post-redaction). `tokens` are restored
//   locally for display, checks and exits, never sent.
// - The only exits are exits.ts copyText / buildMailto / markSent, and each re-checks the gate.
// - The Gemini acknowledgement lives in sessionStorage through gemini-gate.ts, nowhere else.
// - Announcements never carry key material, raw inputs or draft text (the applied alternative
//   phrase is the one UI-SPEC exception).
import { applyAlternative, type Finding } from '@tran/core/fair-housing';
import type { AiProviderId } from '@tran/core/ai';
import { buildMailto, copyText, markSent as markSentExit } from '../exits';
import { needsGeminiWarning, readGeminiAck, writeGeminiAck } from '../gemini-gate';
import { PROVIDER_LABELS } from '../models';
import type { LlmProvider } from '../ports';
import { buildPrompt, getPrompt } from '../prompts/registry';
import type { BuiltPrompt } from '../prompts/types';
import { runGeneration, type GenerationResult } from '../runner';
import type { Selection } from '../setup';
import type { ArtifactRepo } from '../storage/artifacts';
import type { AiArtifact, ArtifactStatus } from '../storage/tables';
import { errorCopy, statusCopy, type CopyLink } from './ai-copy';
import {
	computeGate,
	displayText,
	exitPayload,
	findingsSentence,
	nextAck,
	runChecks,
	usageLine,
	type ExitDisabled,
	type ExitKind,
	type GateState,
	type PostCheck
} from './panel-controller';

export type PanelRunPhase = 'empty' | 'connecting' | 'streaming' | 'checking' | 'ready';

export type ExitEventPayload = { text: string; artifactId: string | null; href?: string };

export type Resolved = { selection: Selection; provider: LlmProvider; model: string };

export type PanelDeps = {
	promptId: string;
	inputs: unknown;
	feature: string;
	/** Default: getPrompt(promptId).containsClientData. */
	containsClientData?: boolean;
	postChecks?: PostCheck[];
	tokens?: Record<string, string>;
	emailFooter?: { text: string; label: string };
	exitDisabled?: ExitDisabled;
	mailto?: { to?: string; subject?: string };
	onExit?: (kind: ExitKind, payload: ExitEventPayload) => void;
	/** Opaque id stored on each saved artifact (Phase 6: the listing id) for Draft history filtering. */
	subjectId?: string;
	/** Live adapter or the keyless fixture, plus the selection that chose it. */
	resolve: () => Promise<Resolved>;
	/** null in SSR and in tests that don't persist. */
	repo: ArtifactRepo | null;
	/** Phase 3 LiveAnnouncer. */
	announce: (message: string) => void;
	/** Drives the cors-blocked action ("Switch to OpenRouter" vs "Set up OpenRouter"). */
	openRouterKeySaved?: () => boolean;
	clipboard?: { writeText(t: string): Promise<void> };
	session?: Pick<Storage, 'getItem' | 'setItem'>;
	now?: () => Date;
	/** First-token wait before the "Still waiting" line. Default 10 000 ms. */
	waitMs?: number;
	/** Edit recheck debounce. Default 300 ms. */
	recheckMs?: number;
};

export type PanelInitial = {
	text?: string;
	findings?: Finding[];
	status?: ArtifactStatus;
	artifactId?: string;
	selection?: Selection;
	model?: string;
	built?: BuiltPrompt;
};

export type PanelError = { title: string; body: string; action: CopyLink | null };

const SENT_DATE = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric'
});

const flagsLeft = (n: number): string =>
	n === 0 ? 'No Fair Housing flags left.' : n === 1 ? '1 flag left.' : `${n} flags left.`;

export class PanelState {
	readonly deps: PanelDeps;

	phase = $state<PanelRunPhase>('empty');
	text = $state('');
	findings = $state.raw<Finding[]>([]);
	warnAck = $state(false);
	statusLine = $state('');
	error = $state.raw<PanelError | null>(null);
	usageText = $state('');
	artifactId = $state<string | null>(null);
	artifactStatus = $state<ArtifactStatus>('draft');
	editing = $state(false);
	geminiDialogOpen = $state(false);
	built = $state.raw<BuiltPrompt | null>(null);
	selection = $state.raw<Selection | null>(null);
	model = $state('');
	sentAt = $state.raw<Date | null>(null);

	#gate = $derived.by(() =>
		computeGate({
			phase:
				this.phase === 'ready' && this.text !== ''
					? 'ready'
					: this.phase === 'ready' || this.phase === 'empty'
						? 'empty'
						: 'streaming',
			findings: this.findings,
			warnAck: this.warnAck,
			exitDisabled: this.deps.exitDisabled
		})
	);
	#mailto = $derived.by(() => {
		const m = buildMailto({
			to: this.deps.mailto?.to,
			subject: this.deps.mailto?.subject,
			body: exitPayload(this.text, this.deps.emailFooter)
		});
		return { href: m.href, long: m.long };
	});

	#ac: AbortController | null = null;
	#busy = false;
	#marking = false;
	#pending: { r: Resolved; built: BuiltPrompt } | null = null;
	#recheckTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(deps: PanelDeps, initial: PanelInitial = {}) {
		this.deps = deps;
		this.selection = initial.selection ?? null;
		this.model = initial.model ?? '';
		this.built = initial.built ?? null;
		const text = displayText(initial.text ?? '', deps.tokens);
		if (text !== '') {
			this.text = text;
			this.findings = initial.findings ?? runChecks(text, deps.postChecks);
			this.phase = 'ready';
		}
		this.artifactId = initial.artifactId ?? null;
		this.artifactStatus = initial.status ?? 'draft';
	}

	get gate(): GateState {
		return this.#gate;
	}

	get mailto(): { href: string; long: boolean } {
		return this.#mailto;
	}

	get running(): boolean {
		return this.phase === 'connecting' || this.phase === 'streaming';
	}

	get hasDraft(): boolean {
		return this.text !== '';
	}

	/** Sample output (no key, toggle on, or locked); true before the first resolve. */
	get sample(): boolean {
		return this.selection?.kind !== 'live';
	}

	get providerLabel(): string {
		const s = this.selection;
		if (!s) return PROVIDER_LABELS.fixture;
		return s.id ? PROVIDER_LABELS[s.id] : PROVIDER_LABELS.fixture;
	}

	#now(): Date {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- an immutable timestamp value
		return (this.deps.now ?? (() => new Date()))();
	}

	#say(message: string | null): void {
		if (message) this.deps.announce(message);
	}

	#check(text: string): Finding[] {
		return runChecks(text, this.deps.postChecks);
	}

	#sentence(findings: readonly Finding[]): string {
		const block = findings.filter((f) => f.severity === 'block').length;
		return findingsSentence(block, findings.length - block);
	}

	#containsClientData(): boolean {
		return this.deps.containsClientData ?? getPrompt(this.deps.promptId).containsClientData;
	}

	/** Builds the exact prompt for "What will be sent" (and the destination line). */
	async preview(): Promise<void> {
		const r = await this.deps.resolve();
		this.selection = r.selection;
		this.model = r.model;
		this.built = await buildPrompt(this.deps.promptId, this.deps.inputs);
	}

	/** Opens the Gemini dialog instead of running when the free-tier gate applies. */
	async generate(): Promise<void> {
		if (this.#busy || this.running) return;
		this.#busy = true;
		try {
			this.error = null;
			const r = await this.deps.resolve();
			this.selection = r.selection;
			this.model = r.model;
			if (r.selection.kind === 'locked') {
				const e = errorCopy('locked', this.#errorContext(r.selection.id));
				this.error = e;
				this.#say(`${e.title}. ${e.body}`);
				return;
			}
			const built = await buildPrompt(this.deps.promptId, this.deps.inputs);
			this.built = built;
			const live = r.selection.kind === 'live';
			if (
				needsGeminiWarning({
					provider: r.selection.kind === 'live' ? r.selection.id : 'fixture',
					sample: !live,
					containsClientData: this.#containsClientData(),
					acked: readGeminiAck(this.deps.session)
				})
			) {
				this.#pending = { r, built };
				this.geminiDialogOpen = true;
				return;
			}
			await this.#run(r, built, live && r.selection.id === 'gemini');
		} finally {
			this.#busy = false;
		}
	}

	stop(): void {
		this.#ac?.abort();
	}

	async confirmGemini(dontAskAgain: boolean): Promise<void> {
		this.geminiDialogOpen = false;
		const pending = this.#pending;
		this.#pending = null;
		if (dontAskAgain) writeGeminiAck(this.deps.session);
		if (!pending) return;
		await this.#run(pending.r, pending.built, true);
	}

	cancelGemini(): void {
		this.geminiDialogOpen = false;
		this.#pending = null;
		const s = statusCopy('gemini-canceled', { providerLabel: this.providerLabel });
		this.statusLine = s.line;
		this.#say(s.announce);
	}

	#errorContext(provider: AiProviderId | null) {
		const id: AiProviderId = provider ?? 'fixture';
		return {
			provider: id,
			providerLabel: PROVIDER_LABELS[id],
			model: this.model,
			openRouterKeySaved: this.deps.openRouterKeySaved?.() ?? false
		};
	}

	async #run(r: Resolved, built: BuiltPrompt, clientDataAck: boolean): Promise<void> {
		const ac = new AbortController();
		this.#ac = ac;
		const sample = r.selection.kind !== 'live';
		const providerLabel = this.providerLabel;

		clearTimeout(this.#recheckTimer);
		this.text = '';
		this.findings = [];
		this.warnAck = false;
		this.usageText = '';
		this.error = null;
		this.editing = false;
		this.artifactId = null;
		this.artifactStatus = 'draft';
		this.sentAt = null;
		this.phase = 'connecting';

		const start = statusCopy(sample ? 'sample-streaming' : 'connecting', { providerLabel });
		this.statusLine = start.line;
		this.#say(start.announce);

		let waitTimer: ReturnType<typeof setTimeout> | undefined;
		if (!sample) {
			waitTimer = setTimeout(() => {
				if (this.phase !== 'connecting' || ac.signal.aborted) return;
				const w = statusCopy('waiting', { providerLabel });
				this.statusLine = w.line;
				this.#say(w.announce);
			}, this.deps.waitMs ?? 10_000);
		}

		let result: GenerationResult | undefined;
		try {
			for await (const u of runGeneration({
				prompt: built,
				provider: r.provider,
				model: r.model,
				signal: ac.signal,
				clientDataAck
			})) {
				if (u.type === 'first-token') {
					clearTimeout(waitTimer);
					this.phase = 'streaming';
					if (!sample) this.statusLine = statusCopy('streaming', { providerLabel }).line;
				} else if (u.type === 'text') {
					this.text = displayText(u.text, this.deps.tokens);
				} else {
					result = u.result;
				}
			}
		} finally {
			clearTimeout(waitTimer);
			if (this.#ac === ac) this.#ac = null;
		}
		if (!result) return;

		const findings = this.#check(this.text);
		this.findings = findings;
		this.phase = 'ready';
		const sentence = this.#sentence(findings);

		if (result.status === 'error') {
			const e = errorCopy(result.error?.kind ?? 'interrupted', {
				...this.#errorContext(sample ? 'fixture' : r.selection.id),
				model: r.model
			});
			this.error = e;
			this.statusLine = '';
			this.#say(`${e.title}. ${e.body}`);
		} else {
			const s =
				result.status === 'stopped'
					? this.text === ''
						? statusCopy('stopped-empty', { providerLabel })
						: statusCopy('stopped', { providerLabel, findingsSentence: sentence })
					: result.finish === 'length'
						? statusCopy('length', { providerLabel })
						: statusCopy('done', { providerLabel, findingsSentence: sentence });
			this.statusLine = s.line;
			this.#say(s.announce);
		}

		this.usageText = usageLine({
			providerLabel,
			usage: result.usage,
			costUsd: result.estimatedCostUsd,
			status: result.status,
			sample
		});

		if (this.text !== '' && this.deps.repo) {
			const a = await this.deps.repo.create({
				feature: this.deps.feature,
				promptId: built.promptId,
				provider: result.provider,
				model: r.model,
				sample,
				inputHash: built.inputHash,
				text: this.text,
				findings,
				...(this.deps.subjectId !== undefined ? { subjectId: this.deps.subjectId } : {})
			});
			this.artifactId = a.id;
			this.artifactStatus = a.status;
		}
	}

	/**
	 * Applies a finding's alternative, rechecks and announces. Returns the id of the next
	 * unresolved finding in reading order (null when none remain) so the view can move focus.
	 */
	apply(findingId: string): { nextFindingId: string | null } {
		const f = this.findings.find((x) => x.id === findingId);
		if (!f) return { nextFindingId: null };
		const alternative =
			(f.members.find((m) => m.severity === 'block') ?? f.members[0])?.alternative ?? '';
		const { text, cursor } = applyAlternative(this.text, f);
		this.text = text;
		this.recheckNow();
		const left = this.findings.length;
		const lead = alternative === '' ? 'Removed the phrase.' : `Replaced with "${alternative}".`;
		this.#say(`${lead} ${flagsLeft(left)}`);
		const next = [...this.findings].sort((a, b) => a.start - b.start);
		return { nextFindingId: (next.find((x) => x.start >= cursor) ?? next[0])?.id ?? null };
	}

	/** Edit mode: updates the text and rechecks after `recheckMs` without typing. */
	setText(next: string): void {
		this.text = next;
		clearTimeout(this.#recheckTimer);
		this.#recheckTimer = setTimeout(() => this.recheckNow(), this.deps.recheckMs ?? 300);
	}

	recheckNow(): void {
		clearTimeout(this.#recheckTimer);
		const prev = this.findings;
		const next = this.#check(this.text);
		this.findings = next;
		this.warnAck = nextAck(this.warnAck, prev, next);
		if (this.text !== '' && this.phase === 'empty') this.phase = 'ready';
		if (this.artifactId && this.deps.repo) {
			void this.deps.repo.updateText(this.artifactId, this.text, next);
		}
	}

	/** True (and announces the reason) when the exit is gated. */
	#gated(kind: ExitKind): boolean {
		const g = this.gate.exits[kind];
		if (!g.gated) return false;
		this.#say(g.reason);
		return true;
	}

	#payload(): string {
		return exitPayload(this.text, this.deps.emailFooter);
	}

	async #reviewed(): Promise<void> {
		if (!this.artifactId || this.artifactStatus !== 'draft') return;
		this.artifactStatus = 'acknowledged';
		await this.deps.repo?.setStatus(this.artifactId, 'acknowledged', this.#now());
	}

	/** Copy text. Resolves false when the browser refused (the view then selects the text). */
	async copy(): Promise<boolean> {
		if (this.#gated('copy')) return false;
		const text = this.#payload();
		const ok = await copyText(text, this.deps.clipboard);
		const s = statusCopy(ok ? 'copied' : 'copy-failed', { providerLabel: this.providerLabel });
		this.statusLine = s.line;
		this.#say(s.announce);
		if (!ok) return false;
		await this.#reviewed();
		this.deps.onExit?.('copy', { text, artifactId: this.artifactId });
		return true;
	}

	/**
	 * The user clicked the enabled "Open in email app" link (the browser follows the email href
	 * itself). Returns false when gated so the view can cancel the navigation.
	 */
	emailClicked(): boolean {
		if (this.#gated('email')) return false;
		const s = statusCopy('emailed', { providerLabel: this.providerLabel });
		this.statusLine = s.line;
		this.#say(s.announce);
		void this.#reviewed();
		this.deps.onExit?.('email', {
			text: this.#payload(),
			artifactId: this.artifactId,
			href: this.mailto.href
		});
		return true;
	}

	/** A local Draft history note, never a delivery. Pressing it again does nothing. */
	async markSent(): Promise<void> {
		if (this.#gated('marked-sent')) return;
		if (this.artifactStatus === 'sent' || this.#marking) return;
		this.#marking = true;
		try {
			const repo = this.deps.repo;
			const at =
				this.artifactId && repo
					? await markSentExit(this.artifactId, repo, () => this.#now())
					: this.#now();
			this.artifactStatus = 'sent';
			this.sentAt = at;
			const s = statusCopy('marked-sent', {
				providerLabel: this.providerLabel,
				date: SENT_DATE.format(at)
			});
			this.statusLine = s.line;
			this.#say(s.announce);
			this.deps.onExit?.('marked-sent', { text: this.#payload(), artifactId: this.artifactId });
		} finally {
			this.#marking = false;
		}
	}

	/** Draft history "Open": re-runs the checker on the current lexicon and keeps the status. */
	open(artifact: AiArtifact): void {
		this.stop();
		clearTimeout(this.#recheckTimer);
		this.text = artifact.text;
		this.findings = this.#check(artifact.text);
		this.warnAck = false;
		this.phase = artifact.text === '' ? 'empty' : 'ready';
		this.editing = false;
		this.error = null;
		this.usageText = '';
		this.statusLine = '';
		this.artifactId = artifact.id;
		this.artifactStatus = artifact.status;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- an immutable timestamp value
		this.sentAt = artifact.sentAt ? new Date(artifact.sentAt) : null;
		this.model = artifact.model;
		this.#say(`Draft opened. ${this.#sentence(this.findings)}`);
	}
}
