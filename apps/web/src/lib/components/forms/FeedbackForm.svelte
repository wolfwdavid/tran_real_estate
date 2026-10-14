<script lang="ts">
	// Feedback form for /feedback/ (GTM-02, UI-SPEC FeedbackForm). Same rules as WaitlistForm: open
	// only when the owner's Web3Forms key is built in, otherwise a coming-soon panel with no fields.
	// Submit order: validate, then the key scan (a pasted API key blocks the send, nothing leaves the
	// browser), then the honeypot/timing gate, then ONE request to https://api.web3forms.com/submit
	// carrying only the topic, the message, the optional email and fixed labels. Nothing is stored.
	// The message and email fields have no `name`: a submit before hydration falls back to a native
	// GET to the same page, and without names nothing typed lands in the URL or history.
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Send from '@lucide/svelte/icons/send';
	import { findKeyMaterial } from '@tran/core/backup';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { FORMS_COPY } from '$lib/content/forms';
	import { submitOwnerForm } from '$lib/leads/owner-forms';
	import ComingSoonPanel from './ComingSoonPanel.svelte';
	import FormError from './FormError.svelte';
	import FormSuccess from './FormSuccess.svelte';
	import { MAX_FEEDBACK, counterText, crossedThreshold, topicFromSearch } from './feedback-counter';
	import {
		TOPICS,
		feedbackBody,
		formMode,
		gateSubmit,
		validateEmail,
		type EmailError,
		type Topic
	} from './form-gate';

	interface Props {
		accessKey?: string;
		contactEmail?: string;
	}

	let { accessKey, contactEmail }: Props = $props();

	const copy = FORMS_COPY.feedback;
	const mode = $derived(formMode(accessKey ?? '', contactEmail ?? ''));

	type MessageError = 'empty' | 'keyFound';

	let topic = $state<Topic>('other');
	let message = $state('');
	let email = $state('');
	let honeypot = $state(false);
	let messageError = $state<MessageError | null>(null);
	let emailError = $state<EmailError | null>(null);
	let tooFast = $state(false);
	let failure = $state<{ title: string; body: string } | null>(null);
	let sending = $state(false);
	let sent = $state(false);
	// Date.now() (not performance.now()) so Playwright's clock controls the timing gate.
	let mountedAt = 0;
	let prevLen = 0;

	let topicEl = $state<HTMLElement | null>(null);
	let messageEl = $state<HTMLTextAreaElement | null>(null);
	let emailEl = $state<HTMLInputElement | null>(null);
	let buttonEl = $state<HTMLButtonElement | null>(null);
	let successTitle = $state<HTMLParagraphElement | null>(null);

	// Hydration marker: the prerendered form is inert until this is set (specs wait on it).
	let ready = $state(false);

	onMount(() => {
		topic = topicFromSearch(location.search);
		mountedAt = Date.now();
		ready = true;
	});

	function oninput(event: Event) {
		// Read the element, not `message`: the bound value may update after this handler runs.
		const len = (event.currentTarget as HTMLTextAreaElement).value.length;
		if (crossedThreshold(prevLen, len)) announce(`${copy.counterLeft(MAX_FEEDBACK - len)}.`);
		prevLen = len;
		if (messageError !== null && message.trim() !== '') messageError = null;
	}

	function onEmailBlur() {
		// Optional field: validated on blur only once something was typed or an error is shown.
		if (email.trim() !== '' || emailError !== null) emailError = validateEmail(email, false);
	}

	function focusTopic() {
		topicEl?.querySelector<HTMLElement>('[data-state="checked"]')?.focus();
	}

	async function showSuccess() {
		sent = true;
		await tick();
		successTitle?.focus();
		announce(copy.successAnnouncement);
	}

	async function sendMore() {
		message = '';
		email = '';
		prevLen = 0;
		honeypot = false;
		messageError = null;
		emailError = null;
		tooFast = false;
		failure = null;
		sent = false;
		mountedAt = Date.now();
		await tick();
		focusTopic();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (sending) return;
		failure = null;
		tooFast = false;

		messageError = message.trim() === '' ? 'empty' : null;
		emailError = validateEmail(email, false);
		if (messageError !== null) return messageEl?.focus();
		if (emailError !== null) return emailEl?.focus();

		// A key-shaped string in either field blocks the send. Nothing is requested.
		if (findKeyMaterial(JSON.stringify({ message, email }), []).length > 0) {
			messageError = 'keyFound';
			messageEl?.focus();
			return;
		}

		const g = gateSubmit({ honeypot, mountedAt, now: Date.now() });
		if (g === 'bot') return showSuccess();
		if (g === 'too-fast') {
			tooFast = true;
			announce(copy.tooFast);
			return;
		}

		sending = true;
		const r = await submitOwnerForm(feedbackBody({ key: accessKey ?? '', topic, message, email }));
		sending = false;
		if (r.ok) return showSuccess();

		failure = r.kind === 'network' ? copy.networkError : copy.rejectedError;
		announce(`${failure.title}. ${failure.body}`);
		// The button was disabled while sending; let it re-enable before focus returns to it.
		await tick();
		buttonEl?.focus();
	}

	const helper = 'text-label text-muted-foreground';
	const errorLine = 'flex items-center gap-1 text-label text-destructive';
</script>

<div class="max-w-reading">
	{#if mode !== 'open'}
		<ComingSoonPanel
			title={copy.comingSoonTitle}
			body={mode === 'coming-soon-contact' ? copy.comingSoonContactBody : copy.comingSoonBody}
			contactEmail={mode === 'coming-soon-contact' ? contactEmail : undefined}
			subject={copy.mailSubject}
			linkText={copy.comingSoonLink}
		/>
	{:else if sent}
		<FormSuccess title={copy.successTitle} body={copy.successBody} bind:titleEl={successTitle}>
			<div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
				<Button variant="ghost" onclick={sendMore}>{copy.sendMore}</Button>
				<a
					href={resolve('/')}
					class="text-primary underline underline-offset-3 hover:text-primary-hover"
					>{copy.backHome}</a
				>
			</div>
		</FormSuccess>
	{:else}
		<form
			novalidate
			onsubmit={submit}
			data-ready={ready ? '' : undefined}
			aria-busy={sending}
			aria-label={copy.h1}
			class="grid gap-4"
		>
			{#if failure}
				<FormError
					title={failure.title}
					body={failure.body}
					{contactEmail}
					subject={copy.mailSubject}
				/>
			{/if}
			{#if tooFast}
				<p data-too-fast class="flex items-start gap-2 text-foreground">
					<CircleAlert size={20} class="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
					<span>{copy.tooFast}</span>
				</p>
			{/if}

			<fieldset bind:this={topicEl} disabled={sending}>
				<legend id="feedback-topic-legend" class="font-semibold">{copy.legend}</legend>
				<RadioGroup.Root
					bind:value={topic}
					aria-labelledby="feedback-topic-legend"
					class="mt-2 gap-0"
				>
					{#each TOPICS as [id, label] (id)}
						<label
							for="feedback-topic-{id}"
							class="flex min-h-11 cursor-pointer items-center gap-3 text-body"
						>
							<RadioGroup.Item value={id} id="feedback-topic-{id}" />
							{label}
						</label>
					{/each}
				</RadioGroup.Root>
			</fieldset>

			<div class="grid gap-2">
				<label for="feedback-message" class="font-semibold">{copy.messageLabel}</label>
				<Textarea
					id="feedback-message"
					bind:ref={messageEl}
					bind:value={message}
					{oninput}
					required
					maxlength={MAX_FEEDBACK}
					disabled={sending}
					aria-invalid={messageError !== null ? 'true' : undefined}
					aria-describedby="feedback-message-helper feedback-message-counter feedback-message-error"
					class="min-h-40"
				/>
				<p id="feedback-message-helper" class={helper}>{copy.messageHelper}</p>
				<p id="feedback-message-counter" aria-live="off" class="{helper} tabular-nums">
					{counterText(message.length)}
				</p>
				<p id="feedback-message-error" class={errorLine}>
					{#if messageError !== null}
						<CircleAlert size={16} class="shrink-0" aria-hidden="true" />{copy.validation[
							messageError
						]}
					{/if}
				</p>
			</div>

			<div class="grid gap-2">
				<label for="feedback-email" class="font-semibold">{copy.emailLabel}</label>
				<input
					id="feedback-email"
					bind:this={emailEl}
					bind:value={email}
					onblur={onEmailBlur}
					type="email"
					autocomplete="email"
					inputmode="email"
					autocapitalize="off"
					spellcheck="false"
					maxlength={254}
					disabled={sending}
					aria-invalid={emailError !== null ? 'true' : undefined}
					aria-describedby="feedback-email-helper feedback-email-error"
					class="h-12 w-full min-w-0 rounded-md border border-input bg-card px-4 text-body text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground aria-invalid:border-destructive"
				/>
				<p id="feedback-email-helper" class={helper}>{copy.emailHelper}</p>
				<p id="feedback-email-error" class={errorLine}>
					{#if emailError !== null}
						<CircleAlert size={16} class="shrink-0" aria-hidden="true" />{copy.validation[
							emailError
						]}
					{/if}
				</p>
			</div>

			<div>
				<Button type="submit" bind:ref={buttonEl} disabled={sending} class="w-full sm:w-auto">
					<span class="grid">
						<span
							class="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"
							class:invisible={sending}
						>
							<Send size={16} aria-hidden="true" />{copy.button}
						</span>
						<span
							class="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"
							class:invisible={!sending}
						>
							<LoaderCircle
								size={16}
								class="motion-safe:animate-spin"
								aria-hidden="true"
							/>{copy.sending}
						</span>
					</span>
				</Button>
			</div>

			<!-- Spam trap: display:none via a class (CSP forbids inline styles), so it is out of the
			     tab order and the accessibility tree. A checked box sends nothing. -->
			<div class="hp">
				<label>
					Leave this unchecked
					<input
						type="checkbox"
						name="botcheck"
						tabindex="-1"
						autocomplete="off"
						bind:checked={honeypot}
					/>
				</label>
			</div>
		</form>
	{/if}
</div>

<style>
	.hp {
		display: none;
	}
</style>
