<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import FilePen from '@lucide/svelte/icons/file-pen';
	import MailCheck from '@lucide/svelte/icons/mail-check';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { ArtifactStatus } from '$lib/ai/storage/artifacts';

	// Stored-draft status (05-UI-SPEC ArtifactStatusBadge). The text alone carries the state; color
	// and icon are reinforcement only. draft → Draft, acknowledged → Reviewed, sent → Marked as sent.
	let { status }: { status: ArtifactStatus } = $props();
</script>

{#if status === 'sent'}
	<Badge variant="positive">
		<MailCheck size={14} aria-hidden="true" />
		Marked as sent
	</Badge>
{:else if status === 'acknowledged'}
	<Badge variant="positive">
		<CircleCheck size={14} aria-hidden="true" />
		Reviewed
	</Badge>
{:else}
	<Badge variant="neutral">
		<FilePen size={14} aria-hidden="true" />
		Draft
	</Badge>
{/if}
