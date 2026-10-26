import { defineContentScript } from 'wxt/utils/define-content-script';
import { ZILLOW_MATCH } from '../../lib/config';

// Stub so `wxt prepare` always has an entrypoint; plan 11-10 replaces the body.
export default defineContentScript({ matches: [ZILLOW_MATCH], runAt: 'document_idle', main() {} });
