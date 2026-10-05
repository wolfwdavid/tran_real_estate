<script lang="ts">
	import SectionError from './SectionError.svelte';
</script>

<!-- Page-level: shown above the first section when site storage (IndexedDB) is blocked. -->
<SectionError
	title="This browser is blocking site storage"
	body="Tran can't save keys or data beyond this tab. Allow cookies and site data for this site, or leave private browsing, then reload the page."
	class="mb-12"
/>
