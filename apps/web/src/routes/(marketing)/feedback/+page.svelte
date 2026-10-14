<script lang="ts">
	// /feedback/ (GTM-02, UI-SPEC "Feedback (/feedback/)"). Open with the owner's Web3Forms key built
	// in; otherwise FeedbackForm shows its coming-soon panel. ?portal= pre-selects the topic.
	import FeedbackForm from '$lib/components/forms/FeedbackForm.svelte';
	import { FORMS_COPY } from '$lib/content/forms';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { CONTACT_EMAIL, WEB3FORMS_KEY } from '$lib/site';

	const copy = FORMS_COPY.feedback;
</script>

<SeoHead
	title="Send feedback: Tran Real Estate Tools"
	description="Send feedback about Tran Real Estate Tools: the renter, investor, and agent portals and the free calculators."
/>

<div class="mx-auto max-w-page px-6 py-12 md:px-8 md:py-16">
	<div class="max-w-reading">
		<h1 class="font-display text-display font-semibold">{copy.h1}</h1>
		<p class="mt-4 text-body text-muted-foreground">{copy.lead}</p>
		<div class="mt-8">
			<FeedbackForm
				accessKey={WEB3FORMS_KEY || undefined}
				contactEmail={CONTACT_EMAIL || undefined}
			/>
		</div>
	</div>
</div>
