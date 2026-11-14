<script lang="ts">
	import AudiencePage from '#lib/components/marketing/AudiencePage.svelte';
	import { agentAudience } from '#lib/content/audiences.ts';
</script>

<AudiencePage audience={agentAudience} />
