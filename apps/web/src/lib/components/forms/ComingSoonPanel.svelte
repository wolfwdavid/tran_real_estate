<script lang="ts">
	// Neutral "not open yet" panel for the site's own forms when the owner's Web3Forms key is not
	// built in (UI-SPEC WaitlistForm coming-soon state). It renders NO form fields. The mailto link
	// appears only when a real contact address is configured; there is never a placeholder address.
	import Mail from '@lucide/svelte/icons/mail';
	import { mailtoHref } from './form-gate';

	interface Props {
		title: string;
		body: string;
		contactEmail?: string;
		subject: string;
		linkText: string;
	}

	let { title, body, contactEmail, subject, linkText }: Props = $props();
</script>

<div data-coming-soon class="flex gap-3 rounded-lg bg-surface p-4 sm:p-6">
	<Mail size={20} class="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
	<div class="grid gap-1">
		<p class="font-semibold">{title}</p>
		<p>{body}</p>
		{#if contactEmail}
			<p>
				<a
					href={mailtoHref(contactEmail, subject)}
					rel="external"
					class="text-primary underline underline-offset-3 hover:text-primary-hover">{linkText}</a
				>
			</p>
		{/if}
	</div>
</div>
