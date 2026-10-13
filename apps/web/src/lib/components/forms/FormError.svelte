<script lang="ts">
	// Send-failure alert for the site's own forms. Phase 3 SectionError (destructive rule + icon on
	// card, never role="alert") plus, when a contact address is configured, "Or email {contactEmail}."
	// with a mailto link under it. The parent form announces "{title}. {body}" on every failure
	// (SectionError's own mount announcement is off, so a repeated failure is announced again).
	import SectionError from '$lib/features/shared/settings/SectionError.svelte';
	import { mailtoHref } from './form-gate';

	interface Props {
		title: string;
		body: string;
		contactEmail?: string;
		/** Prefilled mailto subject for the contact link. */
		subject?: string;
	}

	let { title, body, contactEmail, subject = 'Tran' }: Props = $props();
</script>

<div data-form-error class="grid gap-2">
	<SectionError {title} {body} announceOnMount={false} />
	{#if contactEmail}
		<p class="text-body">
			Or email <a
				href={mailtoHref(contactEmail, subject)}
				rel="external"
				class="text-primary underline underline-offset-3 hover:text-primary-hover">{contactEmail}</a
			>.
		</p>
	{/if}
</div>
