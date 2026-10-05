// The ONLY import surface for routes and features (ESLint DATA_INTERNALS). Views read with
// createPeekStore/peek; only click handlers and the scheduler spend.
//
// Keep this list explicit and additive. Never re-export the RentCast client, fetch bridges,
// repos or grant issuing: those stay behind the gateway.
export {
	createDataRuntime,
	setDataRuntime,
	getDataRuntime,
	type DataRuntime,
	type CapPrompt,
	type KeyTestRecord,
	type RuntimeUsage
} from './runtime.svelte';
export { createPeekStore, type PeekStore } from './stores.svelte';
export {
	ReactiveSpendError,
	type DataGateway,
	type GatewayResult,
	type PeekResult,
	type CostEstimate
} from './gateway';
export type { ResolvedMode, DataMode, ModeReason } from './mode';
export type { DataSourcePref } from './tables';
export type { RentCastKeyState, RentCastKeyTestOutcome } from './platform';
export { SAMPLE_METROS } from './fixtures/sample-metros';
export {
	GatewayError,
	isGatewayError,
	type DataRequest,
	type GatewayErrorKind,
	type GatewayErrorDetail,
	type KeyTestOutcome,
	type Provenance
} from '@tran/core/request';
