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
