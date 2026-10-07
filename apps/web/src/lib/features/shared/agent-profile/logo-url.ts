// Object URL for a stored logo (profile preview, BrandPreview, Phase 9 reports). The production
// CSP allows img-src blob: and nothing else beyond 'self', so this is the only way a logo is ever
// rendered. Callers own the URL: revoke it in their effect cleanup.
// Shared by the agent profile and the Studio, so it imports no portal folder.
import type { StoredLogo } from '@tran/core/agent/types';

/** Decodes base64 (no data: URLs anywhere: the build oracle rejects them). */
export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
	const binary = atob(b64);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}

export function logoObjectUrl(logo: StoredLogo): string {
	return URL.createObjectURL(new Blob([base64ToBytes(logo.base64)], { type: logo.mime }));
}
