<script lang="ts">
	// Send-failure alert for the site's own forms. Phase 3 section error look (destructive rule + icon on
	// card, never role="alert") plus, when a contact address is configured, "Or email {contactEmail}."
	// with a mailto link under it. The parent form announces "{title}. {body}" on every failure
	// (this alert never announces on mount, so a repeated failure is announced again).
	// DEBT-09: the Alert destructive output is written out statically (no tv/cn in the initial JS).
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
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
	<div
		tabindex="-1"
		data-slot="alert"
		class="group/alert relative grid gap-1 rounded-lg border border-l-4 border-border border-l-destructive bg-card p-4 text-foreground has-[>svg]:grid-cols-[20px_1fr] has-[>svg]:gap-x-3 sm:p-6 *:[svg]:row-span-2 *:[svg]:translate-y-0.5"
	>
		<CircleAlert class="size-5 text-destructive" aria-hidden="true" />
		<div data-slot="alert-title" class="text-body font-semibold group-has-[>svg]/alert:col-start-2">
			{title}
		</div>
		<div
			data-slot="alert-description"
			class="text-body [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-primary-hover [&_p:not(:last-child)]:mb-4"
		>
			{body}
		</div>
	</div>
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
