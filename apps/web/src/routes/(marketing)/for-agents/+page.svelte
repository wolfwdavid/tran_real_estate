<script lang="ts">
	import AudiencePage from '$lib/components/marketing/AudiencePage.svelte';
	import { audiences } from '$lib/content/audiences';
</script>

<AudiencePage audience={audiences.agent} />
