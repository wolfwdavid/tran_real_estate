// Shared agent-profile access (Phase 9, UI-SPEC Planner Notes 1 and 8). features/studio reads the
// agent's profile, effective brand colors, BrandPreview, the logo object URL and the sample agent
// from here, so it never imports the agent CRM folder. features/shared must not import a portal
// folder (eslint SHARED_NO_PORTALS), which keeps this module CRM-free.
//
// The sample profile has one source, packages/core/src/agent/fixtures/sample-profile.ts: core
// tests use it too, and that fixtures/ path is scanned by the real-data guard.
import type { AgentProfile, ProfileInput } from '@tran/core/agent/types';
import { toDisclosureProfileCore } from '@tran/core/disclosure';
import { missingFor, type DisclosureProfile, type DisclosureVariant } from '@tran/core/studio';

export { SAMPLE_AGENT_PROFILE } from '@tran/core/agent/fixtures/sample-profile';
export { effectiveBrandColors } from '@tran/brand/brand-color';
export { default as BrandPreview } from './BrandPreview.svelte';
export { logoObjectUrl } from './logo-url';

/**
 * The saved profile, or null before the agent has saved one. Browser callers only (onMount /
 * event handlers): Dexie loads on first call, never at module top level, so prerendered routes
 * can import this module.
 */
export async function loadAgentProfile(): Promise<AgentProfile | null> {
	const { getProfile } = await import('$lib/storage/agent/profile-repo');
	return getProfile();
}

/** Phase 8 field names and license-type enum mapped onto the studio disclosure formatter. */
export function toDisclosureProfile(p: ProfileInput): DisclosureProfile {
	return toDisclosureProfileCore(p);
}

/** True when every field the variant's disclosure requires is present. */
export function isProfileComplete(p: ProfileInput | null, variant: DisclosureVariant): boolean {
	return p !== null && missingFor(toDisclosureProfile(p), variant).length === 0;
}
