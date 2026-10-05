<script lang="ts">
	// 05-UI-SPEC "GeminiDataDialog" (AI-03). Caller-owned alert-dialog (no trigger inside), rendered
	// outside the panel's state branches. The safe choice is the default everywhere:
	// - initial focus on "Don't send to Gemini"; Escape = Don't send; the overlay never closes it;
	// - the checkbox starts unchecked and is session-only (the caller writes sessionStorage through
	//   gemini-gate.ts). There is no "never ask again" option.
	import { resolve } from '$app/paths';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	let {
		open = $bindable(false),
		idPrefix = 'gemini-data',
		onCancel,
		onSend,
		onCloseAutoFocus,
		inline = false
	}: {
		open?: boolean;
		idPrefix?: string;
		onCancel: () => void;
		onSend: (dontAskAgain: boolean) => void;
		/** bits-ui close auto-focus hook: `e.preventDefault()` then focus the run button. */
		onCloseAutoFocus?: (e: Event) => void;
		/** Test seam: render in place instead of portalling to <body> (SSR structural tests). */
		inline?: boolean;
	} = $props();

	// 05-UI-SPEC "Gemini data dialog" copy, verbatim.
	const TITLE = 'Send client details to Gemini?';
	const BODY_1 =
		"This draft includes details about a client or lead. If your Gemini key is on Google's free tier, Google may use what you send to improve its products.";
	const BODY_2 =
		"Use a paid-tier Gemini key or another provider for client details. Tran can't tell which tier your key is on, so it asks every time.";
	const DONT_ASK = "Don't ask again until I close this tab";
	const OTHER_PROVIDER = 'Choose another provider';
	const DONT_SEND = "Don't send to Gemini";
	const SEND = 'Send to Gemini';

	let dontAskAgain = $state(false);
	let cancelEl = $state<HTMLElement | null>(null);
	const checkId = $derived(`${idPrefix}-dont-ask`);

	// Each opening starts unchecked.
	$effect(() => {
		if (open) dontAskAgain = false;
	});

	function cancel(): void {
		open = false;
		onCancel();
	}

	function send(): void {
		const choice = dontAskAgain;
		open = false;
		onSend(choice);
	}

	function onEscapeKeydown(e: KeyboardEvent): void {
		// cancel() is the single close path for Escape.
		e.preventDefault();
		cancel();
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			cancelEl?.focus();
		}}
		{onCloseAutoFocus}
		{onEscapeKeydown}
		interactOutsideBehavior="ignore"
		portalProps={inline ? { disabled: true } : undefined}
	>
		<AlertDialog.Title>{TITLE}</AlertDialog.Title>
		<AlertDialog.Description class="flex flex-col gap-4 text-base leading-[1.6] text-foreground">
			<span class="block">{BODY_1}</span>
			<span class="block">{BODY_2}</span>
		</AlertDialog.Description>
		<div class="flex min-h-11 items-center gap-3">
			<Checkbox id={checkId} bind:checked={dontAskAgain} />
			<Label for={checkId} class="cursor-pointer text-base leading-[1.6]">{DONT_ASK}</Label>
		</div>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus a same-page fragment -->
		<a href={`${resolve('/settings/')}#ai-drafting`} class="text-base underline">{OTHER_PROVIDER}</a
		>
		<AlertDialog.Footer class="mt-2">
			<Button bind:ref={cancelEl} onclick={cancel} class="w-full sm:w-auto">{DONT_SEND}</Button>
			<Button variant="outline" onclick={send} class="w-full sm:w-auto">{SEND}</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
