// Object URL for a stored logo (profile preview, BrandPreview, Phase 9 reports). The production
// CSP allows img-src blob: and nothing else beyond 'self', so this is the only way a logo is ever
// rendered. Callers own the URL: revoke it in their effect cleanup.
import type { StoredLogo } from '@tran/core/agent/types';
import { base64ToBytes } from './logo-pipeline';

export function logoObjectUrl(logo: StoredLogo): string {
	return URL.createObjectURL(new Blob([base64ToBytes(logo.base64)], { type: logo.mime }));
}
