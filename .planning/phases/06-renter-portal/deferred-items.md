# Phase 6 deferred items

Out-of-scope discoveries logged during execution. Not fixed in Phase 6.

- **OPEN, carried from Phase 4 (04-14) and Phase 5.** tailwind-merge drops the custom font-size
  tokens `text-label` / `text-body` when a variant adds a text colour
  (`twMerge('text-label text-muted-foreground')` returns `text-muted-foreground`). See
  `.planning/phases/04-data-layer-rentcast-gateway-budget-guard-demo-fixtures/deferred-items.md`.
  Fix once, in the shared `cn()` helper (extend tailwind-merge's `font-size` class group with the
  theme tokens), with a unit test; it touches every copied-in primitive, so it needs its own plan.

- **OPEN, found in 06-22.** `ListingCard.svelte` derives its address-link id from the listing id
  only (`card-${row.id}-addr`), and on the Map tab the same card renders in up to three places
  (the hidden List panel, the split list from 1024px, and the map preview), so the id appears more
  than once in the DOM. Behaviour is correct today: the split list and results list scope their
  `querySelector` to their own container, and each article's `aria-labelledby` resolves to a copy
  with the same text, so axe (WCAG 2.2 tags, where `duplicate-id` no longer applies) passes. The
  clean fix is an `idPrefix` prop per container (list / split / preview) threaded through
  `ListingCard`, `ResultsList`, `SplitList` and the preview, with their scoped lookups and the
  `renter-map*` specs updated. Planned for the next renter-touching plan; HUMAN-UAT R12 covers the
  screen-reader side meanwhile. `renter-journey.spec.ts` scopes its click to the selected card.
