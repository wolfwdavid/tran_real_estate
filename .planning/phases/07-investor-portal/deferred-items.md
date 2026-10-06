# Phase 7 deferred items

## From 07-20 (overview + sweep)

- **AutofillButton cost label can be missing when the data runtime starts late (07-15).**
  `AutofillButton.refreshCost()` runs on mount, on form `change`, on pointerenter and on focus. If
  `runtime.gateway` does not exist yet at mount, `estimateCost` throws and the label stays empty
  until one of those events fires. Under full-suite load this makes
  `tests/e2e/investor/autofill.spec.ts` "keyless sample autofill spends nothing" fail
  intermittently (seen in 07-17's run and twice in 07-20's wide runs; 42/42 when run alone).
  Same root cause as the buy-box form race fixed in 07-20 (form gated on `runtime.gateway` and
  keyed on it) and the 07-13 WatchZipForm fix. Suggested fix: re-read the cost when the gateway
  appears (gate the autofill buttons on `runtime.gateway`, or key them on it). Out of 07-20's
  scope: not found by the sweep and owned by 07-15. Candidate for the 07-21 phase gate.
- **Print recheck without notes (07-19 Known Limitation)** is still open; unchanged by 07-20.

## Resolved or recorded by 07-21 (phase gate)

- **AutofillButton late-runtime race: FIXED at the root** (33ecefa test RED, 43c2a28 + 0769526
  fix). AnalyzerForm renders each AutofillButton only once `port.source()` (the runtime's
  gateway, exposed through the investor port so `features/investor` keeps its one `$lib/data`
  adapter) is non-null, keyed on it. New E2E "the cost label appears when the data runtime starts
  after the analyzer" holds the sample-fixture chunk until the address is typed: red before the
  fix, green after. `tests/e2e/investor --repeat-each 3` (438 runs): every autofill run green.
- **buybox.spec "app open checks a due buy box once" flake: FIXED** (477beae). Found in the same
  repeat-each run: the test left the overview as soon as the mock counted the request, aborting
  the in-flight check before its result was stored. It now waits for the overview's "new match
  since your last visit" line. 10/10 on repeat.
- **Print recheck without notes (07-19): RECORDED** for owner sign-off as S2 in
  `07-HUMAN-UAT.md`. It fails closed (blocked at print, never printed unchecked).
